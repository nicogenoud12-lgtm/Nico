"""
Webhook conversacional de Telegram.

Flujo:
1. Recibe update. Valida secret token y user permitido.
2. Si hay pending para el chat → concatena el texto guardado con la nueva respuesta
   y llama a Gemini con el contexto completo.
3. Parsea con Gemini. Crea/borra tx según intent, o pregunta lo que falta.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, date as date_cls

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
        month=partial.get("month"),
        date=date_cls.fromisoformat(partial["date"]),
        desc=partial.get("desc") or partial.get("cat", ""),
        cat=partial["cat"],
        medio=partial["medio"],
        amount=float(partial["amt"]),
        type=partial["type"],
    )
    return crud.create_transaction(db, payload, source="telegram")


def _gemini_to_partial(result: dict) -> dict:
    """Convierte la respuesta de Gemini (intent=create) al formato que acepta _persist."""
    tx_type = result.get("tx_type") or "g"
    raw_amt = abs(float(result.get("amt") or 0))
    # gastos: negativo; ingresos: positivo (convención de la app)
    amt_signed = raw_amt if tx_type == "i" else -raw_amt
    return {
        "date": result.get("date") or date_cls.today().isoformat(),
        "cat": result.get("cat") or "",
        "medio": result.get("medio") or "",
        "amt": amt_signed,
        "type": tx_type,
        "desc": result.get("desc") or "",
    }


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

    # ── Reconstruir contexto si hay pending ───────────────────
    pending = _get_pending(db, chat_id)
    if pending:
        stored = json.loads(pending.partial_json)
        original_text = stored.get("text", "")
        full_text = f"{original_text}. {text}" if original_text else text
    else:
        full_text = text

    # ── Cargar cats / medios / txs recientes desde la DB ──────
    cats = crud.list_categories(db)
    cats_gasto = [c.name for c in cats if c.kind == "gasto"]
    cats_ingreso = [c.name for c in cats if c.kind == "ingreso"]
    mediums = [m.name for m in crud.list_mediums(db)]
    recent = [crud.serialize_tx(t) for t in crud.list_transactions(db)[:10]]

    # ── Llamar a Gemini ───────────────────────────────────────
    result = await parse_telegram_message(full_text, cats_gasto, cats_ingreso, mediums, recent)
    if result is None:
        await send_message(chat_id, messages.GEMINI_ERROR)
        return {"ok": True, "skipped": "gemini_error"}

    intent = result.get("intent", "unknown")

    # ── intent: unknown ───────────────────────────────────────
    if intent == "unknown":
        _clear_pending(db, chat_id)
        reply = result.get("reply") or messages.NOT_UNDERSTOOD_GENERIC
        await send_message(chat_id, reply)
        return {"ok": True, "intent": "unknown"}

    # ── intent: delete ────────────────────────────────────────
    if intent == "delete":
        _clear_pending(db, chat_id)
        tx_id = result.get("tx_id")
        if not tx_id:
            await send_message(chat_id, messages.NOT_FOUND_DELETE)
            return {"ok": True, "intent": "delete", "error": "no_tx_id"}
        deleted = crud.delete_transaction(db, tx_id)
        if not deleted:
            await send_message(chat_id, messages.NOT_FOUND_DELETE)
            return {"ok": True, "intent": "delete", "error": "not_found"}
        summary = result.get("summary") or f"tx #{tx_id}"
        await send_message(chat_id, messages.CONFIRM_DELETE.format(summary=summary))
        return {"ok": True, "intent": "delete", "tx_id": tx_id}

    # ── intent: create ────────────────────────────────────────
    missing = result.get("missing") or []
    if missing:
        _save_pending(db, chat_id, {"text": full_text}, missing)
        await send_message(chat_id, _ask_for(missing[0]))
        return {"ok": True, "intent": "create", "asking": missing[0]}

    partial = _gemini_to_partial(result)
    tx = _persist(db, partial)
    _clear_pending(db, chat_id)
    await send_message(chat_id, _confirmation_text(partial))
    return {"ok": True, "intent": "create", "tx_id": tx.id}
