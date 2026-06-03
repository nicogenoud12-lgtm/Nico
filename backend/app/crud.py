from calendar import monthrange
from datetime import date
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, schemas


# ── helpers ──────────────────────────────────────────────────
def _next_position(db: Session, model, user_id: int) -> int:
    last = (
        db.query(model)
        .filter(model.user_id == user_id)
        .order_by(model.position.desc())
        .first()
    )
    return (last.position + 1) if last else 0


def _get_or_create_category(db: Session, name: str, kind: str, user_id: int) -> models.Category:
    cat = (
        db.query(models.Category)
        .filter(models.Category.name == name, models.Category.user_id == user_id)
        .first()
    )
    if not cat:
        cat = models.Category(
            name=name, color="#b0aaaa", kind=kind,
            position=_next_position(db, models.Category, user_id),
            user_id=user_id,
        )
        db.add(cat)
        db.flush()
    return cat


def _get_or_create_medium(db: Session, name: str, user_id: int) -> models.Medium:
    m = (
        db.query(models.Medium)
        .filter(models.Medium.name == name, models.Medium.user_id == user_id)
        .first()
    )
    if not m:
        m = models.Medium(
            name=name,
            position=_next_position(db, models.Medium, user_id),
            user_id=user_id,
        )
        db.add(m)
        db.flush()
    return m


def _date_to_month(d) -> str:
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
def list_categories(db: Session, user_id: int) -> list[models.Category]:
    return (
        db.query(models.Category)
        .filter(models.Category.user_id == user_id)
        .order_by(models.Category.position.asc(), models.Category.id.asc())
        .all()
    )


def create_category(db: Session, payload: schemas.CategoryCreate, user_id: int) -> models.Category:
    cat = models.Category(
        name=payload.name, color=payload.color, kind=payload.kind,
        position=_next_position(db, models.Category, user_id),
        user_id=user_id,
    )
    db.add(cat)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(cat)
    return cat


def update_category(db: Session, cat_id: int, payload: schemas.CategoryUpdate, user_id: int) -> Optional[models.Category]:
    cat = (
        db.query(models.Category)
        .filter(models.Category.id == cat_id, models.Category.user_id == user_id)
        .first()
    )
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


def delete_category(db: Session, cat_id: int, user_id: int) -> bool:
    cat = (
        db.query(models.Category)
        .filter(models.Category.id == cat_id, models.Category.user_id == user_id)
        .first()
    )
    if not cat:
        return False
    db.delete(cat)
    db.commit()
    return True


def reorder_categories(db: Session, ids: list[int], user_id: int) -> None:
    for pos, cid in enumerate(ids):
        cat = (
            db.query(models.Category)
            .filter(models.Category.id == cid, models.Category.user_id == user_id)
            .first()
        )
        if cat:
            cat.position = pos
    db.commit()


# ── Mediums ──────────────────────────────────────────────────
def list_mediums(db: Session, user_id: int) -> list[models.Medium]:
    return (
        db.query(models.Medium)
        .filter(models.Medium.user_id == user_id)
        .order_by(models.Medium.position.asc(), models.Medium.id.asc())
        .all()
    )


def create_medium(db: Session, payload: schemas.MediumCreate, user_id: int) -> models.Medium:
    m = models.Medium(
        name=payload.name,
        position=_next_position(db, models.Medium, user_id),
        user_id=user_id,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def update_medium(db: Session, mid: int, payload: schemas.MediumUpdate, user_id: int) -> Optional[models.Medium]:
    m = (
        db.query(models.Medium)
        .filter(models.Medium.id == mid, models.Medium.user_id == user_id)
        .first()
    )
    if not m:
        return None
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return m


def delete_medium(db: Session, mid: int, user_id: int) -> bool:
    m = (
        db.query(models.Medium)
        .filter(models.Medium.id == mid, models.Medium.user_id == user_id)
        .first()
    )
    if not m:
        return False
    db.delete(m)
    db.commit()
    return True


def reorder_mediums(db: Session, ids: list[int], user_id: int) -> None:
    for pos, mid in enumerate(ids):
        m = (
            db.query(models.Medium)
            .filter(models.Medium.id == mid, models.Medium.user_id == user_id)
            .first()
        )
        if m:
            m.position = pos
    db.commit()


# ── Tarjetas ─────────────────────────────────────────────────
def list_tarjetas(db: Session, user_id: int) -> list[models.Tarjeta]:
    return (
        db.query(models.Tarjeta)
        .filter(models.Tarjeta.user_id == user_id)
        .order_by(models.Tarjeta.position.asc(), models.Tarjeta.id.asc())
        .all()
    )


def create_tarjeta(db: Session, payload: schemas.TarjetaCreate, user_id: int) -> models.Tarjeta:
    t = models.Tarjeta(
        nombre=payload.nombre, banco=payload.banco, ultimos4=payload.ultimos4,
        cierre=payload.cierre, vence=payload.vence, color_idx=payload.color_idx,
        logo_url=payload.logo_url, user_id=user_id,
        position=_next_position(db, models.Tarjeta, user_id),
    )
    db.add(t)
    db.flush()
    _get_or_create_medium(db, payload.nombre, user_id)
    db.commit()
    db.refresh(t)
    return t


def update_tarjeta(db: Session, tid: int, payload: schemas.TarjetaUpdate, user_id: int) -> Optional[models.Tarjeta]:
    t = (
        db.query(models.Tarjeta)
        .filter(models.Tarjeta.id == tid, models.Tarjeta.user_id == user_id)
        .first()
    )
    if not t:
        return None
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return t


def delete_tarjeta(db: Session, tid: int, user_id: int) -> bool:
    t = (
        db.query(models.Tarjeta)
        .filter(models.Tarjeta.id == tid, models.Tarjeta.user_id == user_id)
        .first()
    )
    if not t:
        return False
    db.delete(t)
    db.commit()
    return True


def reorder_tarjetas(db: Session, ids: list[int], user_id: int) -> None:
    for pos, tid in enumerate(ids):
        t = (
            db.query(models.Tarjeta)
            .filter(models.Tarjeta.id == tid, models.Tarjeta.user_id == user_id)
            .first()
        )
        if t:
            t.position = pos
    db.commit()


# ── Recurrentes ────────────────────────────────────────────
def list_recurrentes(db: Session, user_id: int) -> list[models.Recurrente]:
    return (
        db.query(models.Recurrente)
        .filter(models.Recurrente.user_id == user_id)
        .order_by(models.Recurrente.position.asc(), models.Recurrente.id.asc())
        .all()
    )


def create_recurrente(db: Session, payload: schemas.RecurrenteCreate, user_id: int) -> models.Recurrente:
    r = models.Recurrente(
        nombre=payload.nombre, monto=payload.monto, moneda=payload.moneda,
        frecuencia=payload.frecuencia, vencimiento=payload.vencimiento,
        estado=payload.estado, logo_url=payload.logo_url,
        dia_mes=payload.dia_mes, auto_create=payload.auto_create,
        position=_next_position(db, models.Recurrente, user_id),
        user_id=user_id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def update_recurrente(db: Session, rid: int, payload: schemas.RecurrenteUpdate, user_id: int) -> Optional[models.Recurrente]:
    r = (
        db.query(models.Recurrente)
        .filter(models.Recurrente.id == rid, models.Recurrente.user_id == user_id)
        .first()
    )
    if not r:
        return None
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


def delete_recurrente(db: Session, rid: int, user_id: int) -> bool:
    r = (
        db.query(models.Recurrente)
        .filter(models.Recurrente.id == rid, models.Recurrente.user_id == user_id)
        .first()
    )
    if not r:
        return False
    db.delete(r)
    db.commit()
    return True


def reorder_recurrentes(db: Session, ids: list[int], user_id: int) -> None:
    for pos, rid in enumerate(ids):
        r = (
            db.query(models.Recurrente)
            .filter(models.Recurrente.id == rid, models.Recurrente.user_id == user_id)
            .first()
        )
        if r:
            r.position = pos
    db.commit()


def run_recurrentes(db: Session, user_id: int) -> list[dict]:
    today = date.today()
    current_month = today.strftime("%m%y")

    candidatas = (
        db.query(models.Recurrente)
        .filter(
            models.Recurrente.user_id == user_id,
            models.Recurrente.estado == "activo",
            models.Recurrente.auto_create == True,
            models.Recurrente.dia_mes.isnot(None),
        )
        .all()
    )

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
        tx = create_transaction(db, payload, user_id=user_id, source="cron")
        r.last_run_month = current_month
        db.commit()
        created.append(serialize_tx(tx))
    return created


# ── Months ───────────────────────────────────────────────────
def list_months(db: Session, user_id: int) -> list[models.Month]:
    return (
        db.query(models.Month)
        .filter(models.Month.user_id == user_id)
        .all()
    )


def upsert_month(db: Session, user_id: int, mmyy: str, label: str, short: str,
                 saldo_inicial: float = 0.0, cuotas: float = 0.0) -> models.Month:
    m = db.get(models.Month, (user_id, mmyy))
    if m:
        m.label = label
        m.short = short
        m.saldo_inicial = saldo_inicial
        m.cuotas = cuotas
    else:
        m = models.Month(
            user_id=user_id, mmyy=mmyy, label=label, short=short,
            saldo_inicial=saldo_inicial, cuotas=cuotas,
        )
        db.add(m)
    db.commit()
    db.refresh(m)
    return m


# ── Transactions ─────────────────────────────────────────────
def list_transactions(db: Session, user_id: int) -> list[models.Transaction]:
    return (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == user_id)
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
        .all()
    )


def create_transaction(
    db: Session, payload: schemas.TransactionCreate,
    user_id: int, source: str = "web", origin_ref: str | None = None,
) -> models.Transaction:
    cat = _get_or_create_category(
        db, payload.cat,
        kind="ingreso" if payload.type == "i" else "gasto",
        user_id=user_id,
    )
    medio = _get_or_create_medium(db, payload.medio or "", user_id=user_id)
    month = payload.month or _date_to_month(payload.date)
    tx = models.Transaction(
        user_id=user_id,
        month=month, date=payload.date, desc=payload.desc or "",
        cat_id=cat.id, medio_id=medio.id,
        amt=payload.amount, type=payload.type, source=source,
        currency=payload.currency or "ARS",
        cuota_num=payload.cuota_num,
        cuota_total=payload.cuota_total,
        tarjeta_id=payload.tarjeta_id,
        origin_ref=origin_ref,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def existing_origin_refs(db: Session, user_id: int, refs: list[str]) -> set[str]:
    """REQUIREMENT: dedup de import — devuelve qué origin_refs ya existen para el usuario."""
    if not refs:
        return set()
    rows = (
        db.query(models.Transaction.origin_ref)
        .filter(
            models.Transaction.user_id == user_id,
            models.Transaction.origin_ref.in_(refs),
        )
        .all()
    )
    return {r[0] for r in rows if r[0]}


def existing_impuestos_sigs(db: Session, user_id: int, tarjeta_id: int) -> set[str]:
    """Firmas (fecha|monto) de las txs de "Impuestos Tarjetas" ya cargadas de una
    tarjeta. Permite dedup por contenido aunque el origin_ref viejo no coincida."""
    rows = (
        db.query(models.Transaction.date, models.Transaction.amt)
        .join(models.Category, models.Transaction.cat_id == models.Category.id)
        .filter(
            models.Transaction.user_id == user_id,
            models.Transaction.tarjeta_id == tarjeta_id,
            models.Category.name == "Impuestos Tarjetas",
        )
        .all()
    )
    return {f"{d.isoformat()}|{amt:.2f}" for d, amt in rows}


def get_import_aliases(db: Session, user_id: int) -> dict[str, str]:
    """Mapa clave_de_comercio → nombre elegido por el usuario, para el import."""
    rows = (
        db.query(models.ImportAlias.pattern, models.ImportAlias.alias)
        .filter(models.ImportAlias.user_id == user_id)
        .all()
    )
    return {p: a for p, a in rows}


def upsert_import_alias(db: Session, user_id: int, pattern: str, alias: str) -> None:
    """Crea o actualiza el alias de un comercio para el usuario (idempotente)."""
    if not pattern or not alias:
        return
    row = (
        db.query(models.ImportAlias)
        .filter(models.ImportAlias.user_id == user_id, models.ImportAlias.pattern == pattern)
        .first()
    )
    if row:
        if row.alias != alias:
            row.alias = alias
            db.commit()
        return
    db.add(models.ImportAlias(user_id=user_id, pattern=pattern, alias=alias))
    db.commit()


def update_transaction(
    db: Session, tx_id: int, payload: schemas.TransactionUpdate, user_id: int,
) -> Optional[models.Transaction]:
    tx = (
        db.query(models.Transaction)
        .filter(models.Transaction.id == tx_id, models.Transaction.user_id == user_id)
        .first()
    )
    if not tx:
        return None
    data = payload.model_dump(exclude_unset=True)
    if "cat" in data and data["cat"] is not None:
        cat = _get_or_create_category(
            db, data.pop("cat"),
            kind="ingreso" if (data.get("type") or tx.type) == "i" else "gasto",
            user_id=user_id,
        )
        tx.cat_id = cat.id
    if "medio" in data and data["medio"] is not None:
        medio = _get_or_create_medium(db, data.pop("medio"), user_id=user_id)
        tx.medio_id = medio.id
    if "amount" in data:
        tx.amt = data.pop("amount")
    if "date" in data and data["date"] is not None:
        tx.month = _date_to_month(data["date"])
    for k, v in data.items():
        setattr(tx, k, v)
    db.commit()
    db.refresh(tx)
    return tx


def delete_transaction(db: Session, tx_id: int, user_id: int) -> bool:
    tx = (
        db.query(models.Transaction)
        .filter(models.Transaction.id == tx_id, models.Transaction.user_id == user_id)
        .first()
    )
    if not tx:
        return False
    db.delete(tx)
    db.commit()
    return True


# ── Caja fuerte de dólares ───────────────────────────────────
def serialize_dollar_op(op: models.DollarOp) -> dict:
    tx = op.tx
    tx_amount = None
    if op.rate is not None:
        tx_amount = op.usd * op.rate
    elif op.kind == "retiro":
        tx_amount = op.usd
    return {
        "id": op.id,
        "date": op.date,
        "kind": op.kind,
        "usd": op.usd,
        "rate": op.rate,
        "desc": op.desc,
        "tx_id": op.tx_id,
        "tx_amount": tx_amount,
        "tx_currency": tx.currency if tx else None,
        "tx_cat": tx.category.name if (tx and tx.category) else None,
        "tx_medio": tx.medium.name if (tx and tx.medium) else None,
        "created_at": op.created_at,
    }


def list_dollar_ops(db: Session, user_id: int) -> list[models.DollarOp]:
    return (
        db.query(models.DollarOp)
        .filter(models.DollarOp.user_id == user_id)
        .order_by(models.DollarOp.date.desc(), models.DollarOp.id.desc())
        .all()
    )


def create_dollar_op(db: Session, payload: schemas.DollarOpCreate, user_id: int) -> models.DollarOp:
    tx_id = None
    if payload.kind in ("compra", "venta", "retiro"):
        if not payload.cat:
            raise ValueError("La operación requiere una categoría")
        if payload.kind in ("compra", "venta") and not payload.rate:
            raise ValueError("Compra/venta requieren cotización")

        if payload.kind == "compra":
            tx_type, currency, amount = "g", "ARS", payload.usd * payload.rate
        elif payload.kind == "venta":
            tx_type, currency, amount = "i", "ARS", payload.usd * payload.rate
        else:  # retiro: gasto en dólares
            tx_type, currency, amount = "g", "USD", payload.usd

        tx_payload = schemas.TransactionCreate(
            date=payload.date,
            desc=payload.desc or "",
            cat=payload.cat,
            medio=payload.medio or "",
            amount=amount,
            type=tx_type,
            currency=currency,
            tarjeta_id=payload.tarjeta_id,
        )
        tx = create_transaction(db, tx_payload, user_id=user_id, source="dollar")
        tx_id = tx.id

    op = models.DollarOp(
        user_id=user_id,
        date=payload.date,
        kind=payload.kind,
        usd=payload.usd,
        rate=payload.rate if payload.kind in ("compra", "venta") else None,
        desc=payload.desc or "",
        tx_id=tx_id,
    )
    db.add(op)
    db.commit()
    db.refresh(op)
    return op


def delete_dollar_op(db: Session, op_id: int, user_id: int) -> bool:
    op = (
        db.query(models.DollarOp)
        .filter(models.DollarOp.id == op_id, models.DollarOp.user_id == user_id)
        .first()
    )
    if not op:
        return False
    tx_id = op.tx_id
    db.delete(op)
    db.flush()
    if tx_id:
        delete_transaction(db, tx_id, user_id)
    db.commit()
    return True


# ── BotRules (no son user-scoped — solo del bot del owner) ───
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
    db.delete(rule)
    db.commit()
    return True
