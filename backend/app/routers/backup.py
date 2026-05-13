from datetime import datetime, date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models
from ..auth import get_current_user
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
    return {"id": m.mmyy, "label": m.label, "short": m.short, "saldo_inicial": m.saldo_inicial, "cuotas": m.cuotas}


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
def export_backup(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return {
        "version": 1,
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "categories": [_serialize_cat(c) for c in crud.list_categories(db, user.id)],
        "mediums": [_serialize_med(m) for m in crud.list_mediums(db, user.id)],
        "tarjetas": [_serialize_tarj(t) for t in crud.list_tarjetas(db, user.id)],
        "recurrentes": [_serialize_rec(r) for r in crud.list_recurrentes(db, user.id)],
        "months": [_serialize_month(m) for m in crud.list_months(db, user.id)],
        "transactions": [_serialize_tx_full(t) for t in crud.list_transactions(db, user.id)],
    }


@router.post("/import")
def import_backup(payload: dict, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if payload.get("version") != 1:
        raise HTTPException(400, "Versión de backup no soportada")
    try:
        # Borrar datos existentes del usuario actual
        db.query(models.Transaction).filter_by(user_id=user.id).delete()
        db.query(models.Month).filter_by(user_id=user.id).delete()
        db.query(models.Recurrente).filter_by(user_id=user.id).delete()
        db.query(models.Tarjeta).filter_by(user_id=user.id).delete()
        db.query(models.Medium).filter_by(user_id=user.id).delete()
        db.query(models.Category).filter_by(user_id=user.id).delete()
        db.flush()

        for c in payload.get("categories", []):
            db.add(models.Category(
                name=c["name"], color=c.get("color", "#b0aaaa"),
                kind=c.get("kind", "gasto"), position=c.get("position", 0),
                user_id=user.id,
            ))
        db.flush()

        # Rebuild mediums y mapear ids viejos→nuevos para mantener FKs
        med_map: dict[int, int] = {}
        for m in payload.get("mediums", []):
            new_m = models.Medium(name=m["name"], position=m.get("position", 0), user_id=user.id)
            db.add(new_m)
            db.flush()
            if m.get("id"):
                med_map[m["id"]] = new_m.id

        cat_map: dict[int, int] = {}
        db.flush()
        cats_in_db = db.query(models.Category).filter_by(user_id=user.id).all()
        # Mapear por nombre para FK de transactions (cat_id puede diferir)
        cat_by_name = {c.name: c.id for c in cats_in_db}

        tarj_map: dict[int, int] = {}
        for t in payload.get("tarjetas", []):
            new_t = models.Tarjeta(
                nombre=t["nombre"], banco=t.get("banco", ""), ultimos4=t.get("ultimos4", ""),
                cierre=t.get("cierre", ""), vence=t.get("vence", ""),
                color_idx=t.get("color_idx", 0), position=t.get("position", 0),
                logo_url=t.get("logo_url"), user_id=user.id,
            )
            db.add(new_t)
            db.flush()
            if t.get("id"):
                tarj_map[t["id"]] = new_t.id

        for r in payload.get("recurrentes", []) or payload.get("suscripciones", []):
            db.add(models.Recurrente(
                nombre=r["nombre"], monto=r.get("monto", 0),
                moneda=r.get("moneda", "ARS"), frecuencia=r.get("frecuencia", "mensual"),
                vencimiento=r.get("vencimiento"), estado=r.get("estado", "activo"),
                logo_url=r.get("logo_url"), position=r.get("position", 0),
                user_id=user.id,
            ))

        for mo in payload.get("months", []):
            db.add(models.Month(
                user_id=user.id, mmyy=mo["id"],
                label=mo.get("label", ""), short=mo.get("short", ""),
                saldo_inicial=mo.get("saldo_inicial", 0), cuotas=mo.get("cuotas", 0),
            ))

        for tx in payload.get("transactions", []):
            d = tx["date"]
            if isinstance(d, str):
                d = date_type.fromisoformat(d)
            db.add(models.Transaction(
                user_id=user.id,
                month=tx["month"], date=d, desc=tx.get("desc", ""),
                cat_id=cat_by_name.get(tx.get("cat", "")) if tx.get("cat") else tx.get("cat_id"),
                medio_id=med_map.get(tx.get("medio_id", 0), tx.get("medio_id")),
                tarjeta_id=tarj_map.get(tx.get("tarjeta_id", 0)) if tx.get("tarjeta_id") else None,
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
            "suscripciones": len(payload.get("recurrentes", payload.get("suscripciones", []))),
            "months": len(payload.get("months", [])),
            "transactions": len(payload.get("transactions", [])),
        },
    }
