from calendar import monthrange
from datetime import date
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, schemas


# ── helpers ──────────────────────────────────────────────────
def _next_position(db: Session, model) -> int:
    last = db.query(model).order_by(model.position.desc()).first()
    return (last.position + 1) if last else 0


def _get_or_create_category(db: Session, name: str, kind: str = "gasto") -> models.Category:
    # Buscar por nombre primero (sin filtro de kind) para respetar categorías
    # con kind='inversion' que no deben duplicarse como kind='gasto'.
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


def _date_to_month(d) -> str:
    """Convert date to MMYY string."""
    if hasattr(d, 'strftime'):
        return d.strftime("%m%y")
    return str(d)[5:7] + str(d)[2:4]


def serialize_tx(tx: models.Transaction) -> dict:
    return {
        "id": tx.id,
        "month": tx.month,
        "date": tx.date,
        "desc": tx.desc,
        "cat": tx.category.name if tx.category else "",
        "cat_kind": tx.category.kind if tx.category else "gasto",
        "medio": tx.medium.name if tx.medium else "",
        "amount": tx.amt,
        "type": tx.type,
        "currency": tx.currency or "ARS",
        "cuota_num": tx.cuota_num,
        "cuota_total": tx.cuota_total,
        "tarjeta_id": tx.tarjeta_id,
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
    db.add(cat)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(cat)
    return cat


def update_category(db: Session, cat_id: int, payload: schemas.CategoryUpdate) -> Optional[models.Category]:
    cat = db.get(models.Category, cat_id)
    if not cat:
        return None
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(cat, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(cat)
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


# ── Tarjetas ─────────────────────────────────────────────────
def list_tarjetas(db: Session) -> list[models.Tarjeta]:
    return db.query(models.Tarjeta).order_by(models.Tarjeta.position.asc(), models.Tarjeta.id.asc()).all()


def create_tarjeta(db: Session, payload: schemas.TarjetaCreate) -> models.Tarjeta:
    t = models.Tarjeta(
        nombre=payload.nombre, banco=payload.banco, ultimos4=payload.ultimos4,
        cierre=payload.cierre, vence=payload.vence, color_idx=payload.color_idx,
        position=_next_position(db, models.Tarjeta),
    )
    db.add(t); db.flush()
    # auto-crear medium con el mismo nombre si no existe (matching diseño v2)
    _get_or_create_medium(db, payload.nombre)
    db.commit(); db.refresh(t)
    return t


def update_tarjeta(db: Session, tid: int, payload: schemas.TarjetaUpdate) -> Optional[models.Tarjeta]:
    t = db.get(models.Tarjeta, tid)
    if not t:
        return None
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(t, k, v)
    db.commit(); db.refresh(t)
    return t


def delete_tarjeta(db: Session, tid: int) -> bool:
    t = db.get(models.Tarjeta, tid)
    if not t:
        return False
    db.delete(t); db.commit()
    return True


def reorder_tarjetas(db: Session, ids: list[int]) -> None:
    for pos, tid in enumerate(ids):
        t = db.get(models.Tarjeta, tid)
        if t:
            t.position = pos
    db.commit()


# ── Recurrentes ────────────────────────────────────────────
def list_recurrentes(db: Session) -> list[models.Recurrente]:
    return db.query(models.Recurrente).order_by(models.Recurrente.position.asc(), models.Recurrente.id.asc()).all()


def create_recurrente(db: Session, payload: schemas.RecurrenteCreate) -> models.Recurrente:
    r = models.Recurrente(
        nombre=payload.nombre, monto=payload.monto, moneda=payload.moneda,
        frecuencia=payload.frecuencia, vencimiento=payload.vencimiento,
        estado=payload.estado, logo_url=payload.logo_url,
        dia_mes=payload.dia_mes, auto_create=payload.auto_create,
        position=_next_position(db, models.Recurrente),
    )
    db.add(r); db.commit(); db.refresh(r)
    return r


def update_recurrente(db: Session, rid: int, payload: schemas.RecurrenteUpdate) -> Optional[models.Recurrente]:
    r = db.get(models.Recurrente, rid)
    if not r:
        return None
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(r, k, v)
    db.commit(); db.refresh(r)
    return r


def delete_recurrente(db: Session, rid: int) -> bool:
    r = db.get(models.Recurrente, rid)
    if not r:
        return False
    db.delete(r); db.commit()
    return True


def reorder_recurrentes(db: Session, ids: list[int]) -> None:
    for pos, rid in enumerate(ids):
        r = db.get(models.Recurrente, rid)
        if r:
            r.position = pos
    db.commit()


def run_recurrentes(db: Session) -> list[dict]:
    """Crea una transacción por cada recurrente activa con auto_create=True
    cuyo día de débito ya pasó en el mes actual y aún no fue procesada."""
    today = date.today()
    current_month = today.strftime("%m%y")

    candidatas = db.query(models.Recurrente).filter(
        models.Recurrente.estado == "activo",
        models.Recurrente.auto_create == True,
        models.Recurrente.dia_mes.isnot(None),
    ).all()

    created = []
    for r in candidatas:
        if r.last_run_month == current_month:
            continue
        if today.day < r.dia_mes:
            continue
        last_day = monthrange(today.year, today.month)[1]
        tx_day = min(r.dia_mes, last_day)
        tx_date = today.replace(day=tx_day)
        payload = schemas.TransactionCreate(
            type="g",
            amount=r.monto,
            currency=r.moneda,
            cat="Recurrentes",
            medio="",
            desc=r.nombre,
            date=tx_date,
        )
        tx = create_transaction(db, payload, source="cron")
        r.last_run_month = current_month
        db.commit()
        created.append(serialize_tx(tx))
    return created


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
    medio = _get_or_create_medium(db, payload.medio or "")
    month = payload.month or _date_to_month(payload.date)
    tx = models.Transaction(
        month=month, date=payload.date, desc=payload.desc or "",
        cat_id=cat.id, medio_id=medio.id,
        amt=payload.amount, type=payload.type, source=source,
        currency=payload.currency or "ARS",
        cuota_num=payload.cuota_num,
        cuota_total=payload.cuota_total,
        tarjeta_id=payload.tarjeta_id,
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
    if "amount" in data:
        tx.amt = data.pop("amount")
    if "date" in data and data["date"] is not None:
        tx.month = _date_to_month(data["date"])
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


# ── BotRules ─────────────────────────────────────────────────
def list_bot_rules(db: Session) -> list[models.BotRule]:
    return db.query(models.BotRule).order_by(models.BotRule.created_at.asc()).all()


def save_bot_rule(db: Session, keyword: str, cat: str, tx_type: str = "g") -> models.BotRule:
    import unicodedata
    normalized = "".join(
        c for c in unicodedata.normalize("NFD", keyword.lower().strip())
        if unicodedata.category(c) != "Mn"
    )
    existing = db.get(models.BotRule, normalized)
    if existing:
        existing.cat = cat
        existing.tx_type = tx_type
    else:
        db.add(models.BotRule(keyword=normalized, cat=cat, tx_type=tx_type))
    db.commit()
    return db.get(models.BotRule, normalized)


def delete_bot_rule(db: Session, keyword: str) -> bool:
    rule = db.get(models.BotRule, keyword.lower().strip())
    if not rule:
        return False
    db.delete(rule); db.commit()
    return True
