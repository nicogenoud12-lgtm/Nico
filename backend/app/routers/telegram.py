"""
Webhook conversacional de Telegram.

Flujo:
1. Recibe update. Valida secret token y user permitido.
2. Si hay pending para el chat → la respuesta completa el campo faltante.
3. Si no → parsea el texto. Crea tx si está completa o pregunta lo que falta.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, date as date_cls

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from .. import crud, messages, schemas
from ..config import settings
from ..database import get_db
from ..models import PendingTransaction
from ..parser import parse_message, resolve_field
from ..telegram_client import send_message

router = APIRouter(prefix="/telegram", tags=["telegram"])

PENDING_TTL_MIN = 30


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


def _save_pending(db: Session, chat_id: int, partial: dict, missing: list[str]) -> None:
    existing = db.get(PendingTransaction, chat_id)
    if existing:
        existing.partial_json = json.dumps(partial, default=str)
        existing.missing_fields = ",".join(missing)
        existing.created_at = datetime.utcnow()
    else:
        db.add(PendingTransaction(
            chat_id=chat_id,
            partial_json=json.dumps(partial, default=str),
            missing_fields=",".join(missing),
            created_at=datetime.utcnow(),
        ))
    db.commit()


def _clear_pending(db: Session, chat_id: int) -> None:
    p = db.get(PendingTransaction, chat_id)
    if p:
        db.delete(p); db.commit()


def _ask_for(field: str) -> str:
    return {
        "amt": messages.ASK_AMT,
        "cat": messages.ASK_CAT,
        "medio": messages.ASK_MEDIO,
        "desc": messages.ASK_DESC,
    }.get(field, messages.NOT_UNDERSTOOD_GENERIC)


def _not_understood(field: str) -> str:
    return {
        "amt": messages.NOT_UNDERSTOOD_AMT,
        "cat": messages.NOT_UNDERSTOOD_CAT,
        "medio": messages.NOT_UNDERSTOOD_MEDIO,
    }.get(field, messages.NOT_UNDERSTOOD_GENERIC)


def _confirmation_text(partial: dict) -> str:
    template = messages.CONFIRM_INGRESO if partial["type"] == "i" else messages.CONFIRM_GASTO
    return template.format(
        amt=messages.fmt_amount(partial["amt"]),
        desc=partial.get("desc") or partial.get("cat") or "—",
        cat=partial.get("cat") or "—",
        medio=partial.get("medio") or "—",
    )


def _persist(db: Session, partial: dict):
    payload = schemas.TransactionCreate(
        month=partial["month"],
        date=date_cls.fromisoformat(partial["date"]),
        desc=partial.get("desc") or partial.get("cat", ""),
        cat=partial["cat"],
        medio=partial["medio"],
        amt=float(partial["amt"]),
        type=partial["type"],
    )
    return crud.create_transaction(db, payload, source="telegram")


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

    pending = _get_pending(db, chat_id)

    # ── 1) Hay pending → la respuesta completa el siguiente campo faltante
    if pending:
        partial = json.loads(pending.partial_json)
        missing = [m for m in pending.missing_fields.split(",") if m]
        current = missing[0] if missing else None

        if current:
            value = resolve_field(current, text)
            if value is None:
                await send_message(chat_id, _not_understood(current))
                return {"ok": True, "asking": current}

            if current == "amt":
                amt_abs = abs(float(value))
                partial["amt"] = amt_abs if partial["type"] == "i" else -amt_abs
            else:
                partial[current] = value

            missing = missing[1:]

        if missing:
            _save_pending(db, chat_id, partial, missing)
            await send_message(chat_id, _ask_for(missing[0]))
            return {"ok": True, "asking": missing[0]}

        # completo → persistir
        tx = _persist(db, partial)
        _clear_pending(db, chat_id)
        await send_message(chat_id, _confirmation_text(partial))
        return {"ok": True, "tx_id": tx.id}

    # ── 2) Sin pending → parsear como nuevo
    parsed = parse_message(text)
    if parsed.get("amt") is None and not parsed.get("missing"):
        await send_message(chat_id, messages.NOT_UNDERSTOOD_GENERIC)
        return {"ok": True, "skipped": "unparseable"}

    missing = parsed.get("missing", [])
    if missing:
        _save_pending(db, chat_id, parsed, missing)
        await send_message(chat_id, _ask_for(missing[0]))
        return {"ok": True, "asking": missing[0]}

    tx = _persist(db, parsed)
    await send_message(chat_id, _confirmation_text(parsed))
    return {"ok": True, "tx_id": tx.id}
