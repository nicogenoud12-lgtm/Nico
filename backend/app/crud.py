from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, schemas


# ── helpers ──────────────────────────────────────────────────
def _next_position(db: Session, model) -> int:
    last = db.query(model).order_by(model.position.desc()).first()
    return (last.position + 1) if last else 0


def _get_or_create_category(db: Session, name: str, kind: str = "gasto") -> models.Category:
    cat = db.query(models.Category).filter(models.Category.name == name).first()
    if not cat:
        cat = models.Category(name=name, color="#b0aaaa", kind=kind, position=_next_position(db, models.Category))
        db.add(cat)
        db.flush()
    return cat


def _get_or_create_medium(db: Session, name: str) -> models.Medium:
    m = db.query(models.Medium).filter(models.Medium.name == name).first()
    if not m:
        m = models.Medium(name=name, position=_next_position(db, models.Medium))
        db.add(m)
        db.flush()
    return m


def serialize_tx(tx: models.Transaction) -> dict:
    return {
        "id": tx.id,
        "month": tx.month,
        "date": tx.date,
        "desc": tx.desc,
        "cat": tx.category.name if tx.category else "",
        "medio": tx.medium.name if tx.medium else "",
        "amt": tx.amt,
        "type": tx.type,
        "source": tx.source,
    }


# ── Categories ───────────────────────────────────────────────
def list_categories(db: Session) -> list[models.Category]:
    return db.query(models.Category).order_by(models.Category.position.asc(), models.Category.id.asc()).all()


def create_category(db: Session, payload: schemas.CategoryCreate) -> models.Category:
    cat = models.Category(
        name=payload.name, color=payload.color, kind=payload.kind,
        position=_next_position(db, models.Category)
    )
    db.add(cat); db.commit(); db.refresh(cat)
    return cat


def update_category(db: Session, cat_id: int, payload: schemas.CategoryUpdate) -> Optional[models.Category]:
    cat = db.get(models.Category, cat_id)
    if not cat:
        return None
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(cat, k, v)
    db.commit(); db.refresh(cat)
    return cat


def delete_category(db: Session, cat_id: int) -> bool:
    cat = db.get(models.Category, cat_id)
    if not cat:
        return False
    db.delete(cat); db.commit()
    return True


def reorder_categories(db: Session, ids: list[int]) -> None:
    for pos, cid in enumerate(ids):
        cat = db.get(models.Category, cid)
        if cat:
            cat.position = pos
    db.commit()


# ── Mediums ──────────────────────────────────────────────────
def list_mediums(db: Session) -> list[models.Medium]:
    return db.query(models.Medium).order_by(models.Medium.position.asc(), models.Medium.id.asc()).all()


def create_medium(db: Session, payload: schemas.MediumCreate) -> models.Medium:
    m = models.Medium(name=payload.name, position=_next_position(db, models.Medium))
    db.add(m); db.commit(); db.refresh(m)
    return m


def update_medium(db: Session, mid: int, payload: schemas.MediumUpdate) -> Optional[models.Medium]:
    m = db.get(models.Medium, mid)
    if not m:
        return None
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(m, k, v)
    db.commit(); db.refresh(m)
    return m


def delete_medium(db: Session, mid: int) -> bool:
    m = db.get(models.Medium, mid)
    if not m:
        return False
    db.delete(m); db.commit()
    return True


def reorder_mediums(db: Session, ids: list[int]) -> None:
    for pos, mid in enumerate(ids):
        m = db.get(models.Medium, mid)
        if m:
            m.position = pos
    db.commit()


# ── Months ───────────────────────────────────────────────────
def list_months(db: Session) -> list[models.Month]:
    return db.query(models.Month).all()


# ── Transactions ─────────────────────────────────────────────
def list_transactions(db: Session) -> list[models.Transaction]:
    return (
        db.query(models.Transaction)
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
        .all()
    )


def create_transaction(db: Session, payload: schemas.TransactionCreate, source: str = "web") -> models.Transaction:
    cat = _get_or_create_category(db, payload.cat, kind="ingreso" if payload.type == "i" else "gasto")
    medio = _get_or_create_medium(db, payload.medio)
    tx = models.Transaction(
        month=payload.month, date=payload.date, desc=payload.desc,
        cat_id=cat.id, medio_id=medio.id,
        amt=payload.amt, type=payload.type, source=source,
    )
    db.add(tx); db.commit(); db.refresh(tx)
    return tx


def update_transaction(db: Session, tx_id: int, payload: schemas.TransactionUpdate) -> Optional[models.Transaction]:
    tx = db.get(models.Transaction, tx_id)
    if not tx:
        return None
    data = payload.model_dump(exclude_unset=True)
    if "cat" in data and data["cat"] is not None:
        cat = _get_or_create_category(db, data.pop("cat"), kind="ingreso" if (data.get("type") or tx.type) == "i" else "gasto")
        tx.cat_id = cat.id
    if "medio" in data and data["medio"] is not None:
        medio = _get_or_create_medium(db, data.pop("medio"))
        tx.medio_id = medio.id
    for k, v in data.items():
        setattr(tx, k, v)
    db.commit(); db.refresh(tx)
    return tx


def delete_transaction(db: Session, tx_id: int) -> bool:
    tx = db.get(models.Transaction, tx_id)
    if not tx:
        return False
    db.delete(tx); db.commit()
    return True
