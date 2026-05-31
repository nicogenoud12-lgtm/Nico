"""Importación de resúmenes de tarjeta en PDF (Mercado Pago / Ualá).

Flujo en dos pasos:
  - POST /import/extract  → sube el PDF, Gemini extrae los movimientos y se
    devuelven SIN persistir (con marca de duplicados).
  - POST /import/confirm  → recién acá se crean las transacciones aprobadas.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import crud, models, schemas, statement_import
from ..auth import get_current_user
from ..database import get_db
from ..gemini import extract_statement

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["import"])

MAX_PDF_BYTES = 10 * 1024 * 1024  # 10 MB


def _get_owned_tarjeta(db: Session, tarjeta_id: int, user_id: int) -> models.Tarjeta:
    # Anti-IDOR: la tarjeta tiene que ser del usuario autenticado.
    tarjeta = (
        db.query(models.Tarjeta)
        .filter(models.Tarjeta.id == tarjeta_id, models.Tarjeta.user_id == user_id)
        .first()
    )
    if not tarjeta:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    return tarjeta


@router.post("/extract", response_model=schemas.ImportExtractResponse)
async def extract(
    file: UploadFile = File(...),
    tarjeta_id: int = Form(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    tarjeta = _get_owned_tarjeta(db, tarjeta_id, user.id)

    if (file.content_type or "") not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="El PDF está vacío")
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="El PDF es demasiado grande (máx. 10 MB)")

    cats_gasto = [c.name for c in crud.list_categories(db, user.id) if c.kind == "gasto"]

    raw = await extract_statement(pdf_bytes, cats_gasto, emisor_hint=tarjeta.emisor)
    if raw is None:
        # No se loguea el contenido del resumen (datos personales).
        logger.error("[import] extracción fallida (tarjeta=%s)", tarjeta_id)
        raise HTTPException(status_code=502, detail="No se pudo leer el resumen")

    rows = statement_import.normalize_movimientos(raw, tarjeta_id)
    refs = [r["origin_ref"] for r in rows]
    existing = crud.existing_origin_refs(db, user.id, refs)
    statement_import.mark_duplicates(rows, existing)

    return schemas.ImportExtractResponse(
        tarjeta_id=tarjeta_id,
        periodo=raw.get("periodo"),
        rows=rows,
    )


@router.post("/confirm", response_model=schemas.ImportConfirmResult)
def confirm(
    payload: schemas.ImportConfirm,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    tarjeta = _get_owned_tarjeta(db, payload.tarjeta_id, user.id)

    # REQUIREMENT: la categoría "Impuestos Tarjetas" debe existir (idempotente).
    crud._get_or_create_category(
        db, statement_import.IMPUESTOS_CAT, kind="gasto", user_id=user.id
    )

    # Cada fila aprobada se expande en la cuota actual + las siguientes (si aplica).
    to_create: list[dict] = []
    for row in payload.rows:
        to_create.extend(statement_import.expand_row(row.model_dump(), tarjeta.id))

    # Dedup defensivo: descartar lo que ya existía (cuotas futuras ya proyectadas,
    # reimportación del mismo resumen, etc.).
    existing = crud.existing_origin_refs(db, user.id, [r["origin_ref"] for r in to_create])

    created = 0
    skipped = 0
    for r in to_create:
        if r["origin_ref"] in existing:
            skipped += 1
            continue
        tx_in = schemas.TransactionCreate(
            date=r["date"],
            desc=r["desc"],
            cat=r["cat"],
            medio=tarjeta.nombre,          # el medio queda fijado a la tarjeta elegida
            amount=r["amount"],
            type="g",
            currency="ARS",                # USD ya convertido a ARS en expand_row
            cuota_num=r["cuota_num"],
            cuota_total=r["cuota_total"],
            tarjeta_id=tarjeta.id,
            # month lo deriva create_transaction desde date
        )
        crud.create_transaction(
            db, tx_in, user_id=user.id, source="import", origin_ref=r["origin_ref"]
        )
        existing.add(r["origin_ref"])      # evita duplicar dentro del mismo lote
        created += 1

    return schemas.ImportConfirmResult(created=created, skipped=skipped)
