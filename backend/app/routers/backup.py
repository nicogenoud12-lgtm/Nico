from datetime import datetime, date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models
from ..database import get_db

router = APIRouter(prefix="/backup", tags=["backup"])


def _serialize_cat(c: models.Category) -> dict:
    return {"id": c.id, "name": c.name, "color": c.color, "kind": c.kind, "position": c.position}


def _serialize_med(m: models.Medium) -> dict:
    return {"id": m.id, "name": m.name, "position": m.position}


def _serialize_tarj(t: models.Tarjeta) -> dict:
    return {
        "id": t.id, "nombre": t.nombre, "banco": t.banco, "ultimos4": t.ultimos4,
        "cierre": t.cierre, "vence": t.vence, "color_idx": t.color_idx, "position": t.position,
        "logo_url": t.logo_url,
    }


def _serialize_rec(r: models.Recurrente) -> dict:
    return {
        "id": r.id, "nombre": r.nombre, "monto": r.monto, "moneda": r.moneda,
        "frecuencia": r.frecuencia, "vencimiento": r.vencimiento, "estado": r.estado,
        "logo_url": r.logo_url, "position": r.position,
    }


def _serialize_month(m: models.Month) -> dict:
    return {"id": m.id, "label": m.label, "short": m.short, "saldo_inicial": m.saldo_inicial, "cuotas": m.cuotas}


def _serialize_tx_full(tx: models.Transaction) -> dict:
    return {
        "id": tx.id, "month": tx.month,
        "date": tx.date.isoformat() if isinstance(tx.date, date_type) else tx.date,
        "desc": tx.desc,
        "cat_id": tx.cat_id, "medio_id": tx.medio_id, "tarjeta_id": tx.tarjeta_id,
        "amount": tx.amt, "type": tx.type, "currency": tx.currency or "ARS",
        "cuota_num": tx.cuota_num, "cuota_total": tx.cuota_total,
        "source": tx.source,
    }


@router.get("/export")
def export_backup(db: Session = Depends(get_db)):
    return {
        "version": 1,
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "categories": [_serialize_cat(c) for c in crud.list_categories(db)],
        "mediums": [_serialize_med(m) for m in crud.list_mediums(db)],
        "tarjetas": [_serialize_tarj(t) for t in crud.list_tarjetas(db)],
        "recurrentes": [_serialize_rec(r) for r in crud.list_recurrentes(db)],
        "months": [_serialize_month(m) for m in crud.list_months(db)],
        "transactions": [_serialize_tx_full(t) for t in crud.list_transactions(db)],
    }


@router.post("/import")
def import_backup(payload: dict, db: Session = Depends(get_db)):
    if payload.get("version") != 1:
        raise HTTPException(400, "Versión de backup no soportada")
    try:
        # Borrar todo en orden inverso de FK
        db.query(models.Transaction).delete()
        db.query(models.Month).delete()
        db.query(models.Recurrente).delete()
        db.query(models.Tarjeta).delete()
        db.query(models.Medium).delete()
        db.query(models.Category).delete()
        db.flush()

        for c in payload.get("categories", []):
            db.add(models.Category(
                id=c.get("id"), name=c["name"], color=c.get("color", "#b0aaaa"),
                kind=c.get("kind", "gasto"), position=c.get("position", 0),
            ))
        for m in payload.get("mediums", []):
            db.add(models.Medium(id=m.get("id"), name=m["name"], position=m.get("position", 0)))
        for t in payload.get("tarjetas", []):
            db.add(models.Tarjeta(
                id=t.get("id"), nombre=t["nombre"], banco=t.get("banco", ""),
                ultimos4=t.get("ultimos4", ""), cierre=t.get("cierre", ""),
                vence=t.get("vence", ""), color_idx=t.get("color_idx", 0),
                position=t.get("position", 0),
                logo_url=t.get("logo_url"),
            ))
        for r in payload.get("recurrentes", []) or payload.get("suscripciones", []):
            db.add(models.Recurrente(
                id=r.get("id"), nombre=r["nombre"], monto=r.get("monto", 0),
                moneda=r.get("moneda", "ARS"), frecuencia=r.get("frecuencia", "mensual"),
                vencimiento=r.get("vencimiento"), estado=r.get("estado", "activo"),
                logo_url=r.get("logo_url"), position=r.get("position", 0),
            ))
        for mo in payload.get("months", []):
            db.add(models.Month(
                id=mo["id"], label=mo.get("label", ""), short=mo.get("short", ""),
                saldo_inicial=mo.get("saldo_inicial", 0), cuotas=mo.get("cuotas", 0),
            ))
        for tx in payload.get("transactions", []):
            d = tx["date"]
            if isinstance(d, str):
                d = date_type.fromisoformat(d)
            db.add(models.Transaction(
                id=tx.get("id"), month=tx["month"], date=d, desc=tx.get("desc", ""),
                cat_id=tx.get("cat_id"), medio_id=tx.get("medio_id"), tarjeta_id=tx.get("tarjeta_id"),
                amt=tx.get("amount", tx.get("amt", 0)), type=tx.get("type", "g"),
                currency=tx.get("currency", "ARS"),
                cuota_num=tx.get("cuota_num"), cuota_total=tx.get("cuota_total"),
                source=tx.get("source", "web"),
            ))
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, f"Error al importar backup: {e}")

    return {
        "ok": True,
        "counts": {
            "categories": len(payload.get("categories", [])),
            "mediums": len(payload.get("mediums", [])),
            "tarjetas": len(payload.get("tarjetas", [])),
            "suscripciones": len(payload.get("suscripciones", [])),
            "months": len(payload.get("months", [])),
            "transactions": len(payload.get("transactions", [])),
        },
    }
