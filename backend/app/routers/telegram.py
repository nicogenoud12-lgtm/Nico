"""
Webhook conversacional de Telegram con Gemini.

El bot opera siempre en nombre del owner definido en TELEGRAM_BOT_OWNER_ID.
Adaptador de transporte fino: parsea el update, maneja el historial conversacional
en `PendingTransaction` (por chat_id) y delega la lógica a `bot_core`.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from .. import crud
from ..bot_core import MAX_HISTORY_TURNS, handle_conversation
from ..config import settings
from ..database import get_db
from ..models import PendingTransaction, User
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


def _get_bot_owner(db: Session) -> User:
    if not settings.TELEGRAM_BOT_OWNER_ID:
        raise HTTPException(503, "TELEGRAM_BOT_OWNER_ID no configurado")
    user = db.get(User, settings.TELEGRAM_BOT_OWNER_ID)
    if not user or not user.is_active:
        raise HTTPException(503, "Bot owner no encontrado o inactivo")
    return user


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

    owner = _get_bot_owner(db)

    pending = _get_pending(db, chat_id)
    history: list[dict] = []
    if pending:
        try:
            stored = json.loads(pending.partial_json)
            history = stored.get("history", []) or []
        except json.JSONDecodeError:
            history = []

    res = await handle_conversation(db, owner.id, text, history, source="telegram")

    intent = res["intent"]
    reply = res["reply"]

    if intent == "error":
        await send_message(chat_id, reply)
        return {"ok": True, "skipped": "gemini_error"}

    # create con campos faltantes → guardar historial y repreguntar
    if intent == "create" and res["missing"]:
        _save_pending(db, chat_id, res["new_history"], res["missing"])
        await send_message(chat_id, reply)
        return {"ok": True, "intent": "create", "asking": res["missing"][0]}

    # cualquier otro caso resuelve la conversación → limpiar pending
    _clear_pending(db, chat_id)
    await send_message(chat_id, reply)
    return {"ok": True, "intent": intent, "tx_id": res.get("tx_id")}
