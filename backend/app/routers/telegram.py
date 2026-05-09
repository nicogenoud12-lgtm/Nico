"""
Webhook conversacional de Telegram con Gemini.

- Si hay pending para el chat → reusa el historial de la conversación.
- Cada llamada manda el historial + el nuevo mensaje a Gemini.
- Gemini decide intent (create/delete/unknown) Y genera el texto de respuesta.
"""
from __future__ import annotations

import json
import logging
from calendar import monthrange
from datetime import datetime, timedelta, date as date_cls

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from .. import crud, messages, schemas
from ..config import settings
from ..database import get_db
from ..gemini import parse_telegram_message
from ..models import PendingTransaction
from ..telegram_client import send_message

router = APIRouter(prefix="/telegram", tags=["telegram"])

PENDING_TTL_MIN = 30
MAX_HISTORY_TURNS = 10  # último user+model = 2 turnos


def _validate_secret(x_telegram_bot_api_secret_token: str | None) -> None:
    expected = settings.TELEGRAM_WEBHOOK_SECRET
    if expected and x_telegram_bot_api_secret_token != expected:
        raise HTTPException(401, "Invalid secret token")


def _user_allowed(user_id: int) -> bool:
    allowed = settings.allowed_user_ids
    return not allowed or user_id in allowed


def _get_pending(db: Session, chat_id: int) -> PendingTransaction | None:
    p = db.get(PendingTransaction, chat_id)
    if not p:
        return None
    if p.created_at < datetime.utcnow() - timedelta(minutes=PENDING_TTL_MIN):
        db.delete(p); db.commit()
        return None
    return p


def _save_pending(db: Session, chat_id: int, history: list[dict], missing: list[str]) -> None:
    payload = json.dumps({"history": history[-MAX_HISTORY_TURNS:]}, default=str)
    existing = db.get(PendingTransaction, chat_id)
    if existing:
        existing.partial_json = payload
        existing.missing_fields = ",".join(missing)
        existing.created_at = datetime.utcnow()
    else:
        db.add(PendingTransaction(
            chat_id=chat_id,
            partial_json=payload,
            missing_fields=",".join(missing),
            created_at=datetime.utcnow(),
        ))
    db.commit()


def _clear_pending(db: Session, chat_id: int) -> None:
    p = db.get(PendingTransaction, chat_id)
    if p:
        db.delete(p); db.commit()


def _persist(db: Session, result: dict, tarjetas: list):
    tx_type = result.get("tx_type") or "g"
    raw_amt = abs(float(result.get("amt") or 0))
    cuotas = max(1, min(int(result.get("cuotas") or 1), 48))
    medio = (result.get("medio") or "Efectivo").strip()

    # Resolver tarjeta_id si el medio coincide con una tarjeta del usuario
    medio_lower = medio.lower()
    tarjeta_id = next(
        (t.id for t in tarjetas if t.nombre.lower() == medio_lower), None
    )

    base_date = date_cls.fromisoformat(result.get("date") or date_cls.today().isoformat())
    amt_per_cuota = round(raw_amt / cuotas, 2)
    first_tx = None
    for i in range(cuotas):
        if i == 0:
            d = base_date
        else:
            new_month = (base_date.month - 1 + i) % 12 + 1
            new_year = base_date.year + (base_date.month - 1 + i) // 12
            d = base_date.replace(
                year=new_year, month=new_month,
                day=min(base_date.day, monthrange(new_year, new_month)[1]),
            )
        payload = schemas.TransactionCreate(
            date=d,
            desc=result.get("desc") or result.get("cat") or "",
            cat=result.get("cat") or "",
            medio=medio,
            amount=amt_per_cuota,
            type=tx_type,
            cuota_num=i + 1 if cuotas > 1 else None,
            cuota_total=cuotas if cuotas > 1 else None,
            tarjeta_id=tarjeta_id,
        )
        tx = crud.create_transaction(db, payload, source="telegram")
        if first_tx is None:
            first_tx = tx
    return first_tx


@router.post("/webhook", status_code=200)
async def telegram_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    _validate_secret(x_telegram_bot_api_secret_token)
    update = await request.json()

    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return {"ok": True, "skipped": "no message"}

    text: str = (msg.get("text") or "").strip()
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    user = msg.get("from") or {}
    user_id = user.get("id")

    if not chat_id or not text:
        return {"ok": True, "skipped": "missing chat/text"}

    if user_id and not _user_allowed(user_id):
        await send_message(chat_id, "Mmm no tengo permiso para anotarte gastos a vos 🙅")
        return {"ok": True, "skipped": "user not allowed"}

    # ── Recuperar historial si hay pending ────────────────────
    pending = _get_pending(db, chat_id)
    history: list[dict] = []
    if pending:
        try:
            stored = json.loads(pending.partial_json)
            history = stored.get("history", []) or []
        except json.JSONDecodeError:
            history = []

    # ── Cargar cats / medios / tarjetas / reglas / txs recientes desde la DB ──
    cats = crud.list_categories(db)
    cats_gasto = [c.name for c in cats if c.kind == "gasto"]
    cats_ingreso = [c.name for c in cats if c.kind == "ingreso"]
    mediums = [m.name for m in crud.list_mediums(db)]
    tarjetas = crud.list_tarjetas(db)
    bot_rules = [
        {"keyword": r.keyword, "cat": r.cat, "tx_type": r.tx_type}
        for r in crud.list_bot_rules(db)
    ]
    recent = [crud.serialize_tx(t) for t in crud.list_transactions(db)[:10]]

    # ── Llamar a Gemini con historial ─────────────────────────
    result = await parse_telegram_message(
        text, cats_gasto, cats_ingreso, mediums, recent,
        bot_rules=bot_rules, history=history,
    )
    if result is None:
        await send_message(chat_id, messages.GEMINI_ERROR)
        return {"ok": True, "skipped": "gemini_error"}

    intent = result.get("intent", "unknown")
    reply = (result.get("reply") or "").strip() or messages.NOT_UNDERSTOOD_GENERIC

    # ── intent: unknown ───────────────────────────────────────
    if intent == "unknown":
        _clear_pending(db, chat_id)
        await send_message(chat_id, reply)
        return {"ok": True, "intent": "unknown"}

    # ── intent: learn ────────────────────────────────────────
    if intent == "learn":
        _clear_pending(db, chat_id)
        keyword = (result.get("rule_keyword") or "").strip()
        cat = (result.get("rule_cat") or "").strip()
        rule_tx_type = (result.get("rule_tx_type") or "g").strip()
        if keyword and cat:
            crud.save_bot_rule(db, keyword, cat, rule_tx_type)
            logger.info("[bot] regla guardada: '%s' → %s (%s)", keyword, cat, rule_tx_type)
        await send_message(chat_id, reply)
        return {"ok": True, "intent": "learn", "keyword": keyword, "cat": cat}

    # ── intent: delete ────────────────────────────────────────
    if intent == "delete":
        _clear_pending(db, chat_id)
        tx_id = result.get("tx_id")
        if not tx_id or not crud.delete_transaction(db, tx_id):
            await send_message(chat_id, messages.NOT_FOUND_DELETE)
            return {"ok": True, "intent": "delete", "error": "not_found"}
        await send_message(chat_id, reply)
        return {"ok": True, "intent": "delete", "tx_id": tx_id}

    # ── intent: create ────────────────────────────────────────
    missing = result.get("missing") or []
    new_history = history + [
        {"role": "user", "text": text},
        {"role": "model", "text": reply},
    ]

    if missing:
        _save_pending(db, chat_id, new_history, missing)
        await send_message(chat_id, reply)
        return {"ok": True, "intent": "create", "asking": missing[0]}

    tx = _persist(db, result, tarjetas)
    _clear_pending(db, chat_id)
    await send_message(chat_id, reply)
    return {"ok": True, "intent": "create", "tx_id": tx.id}
