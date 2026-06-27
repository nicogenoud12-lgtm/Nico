"""
Lógica conversacional compartida del bot de gastos (transport-agnostic).

Tanto el webhook de Telegram (`routers/telegram.py`) como el de Alexa
(`routers/alexa.py`) usan `handle_conversation`: arma el contexto del owner,
llama a Gemini, hace branch por intent (create/delete/learn/unknown) y persiste.
Cada transporte se encarga de su propio I/O (enviar mensajes, manejar el
historial conversacional) y del formato de respuesta.
"""
from __future__ import annotations

import logging
from calendar import monthrange
from datetime import date as date_cls

from sqlalchemy.orm import Session

from . import crud, messages, schemas
from .gemini import parse_message

logger = logging.getLogger(__name__)

MAX_HISTORY_TURNS = 10


def _persist(db: Session, result: dict, tarjetas: list, owner_id: int, source: str):
    """Crea la(s) tx (expande cuotas) a nombre del owner. Devuelve la primera."""
    tx_type = result.get("tx_type") or "g"
    raw_amt = abs(float(result.get("amt") or 0))
    cuotas = max(1, min(int(result.get("cuotas") or 1), 48))
    medio = (result.get("medio") or "Contado").strip()

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
        tx = crud.create_transaction(db, payload, user_id=owner_id, source=source)
        if first_tx is None:
            first_tx = tx
    return first_tx


async def handle_conversation(
    db: Session,
    owner_id: int,
    text: str,
    history: list[dict] | None = None,
    *,
    source: str,
    fast: bool = False,
) -> dict:
    """
    Procesa un mensaje del usuario y ejecuta la acción correspondiente.

    Devuelve un dict con:
      - intent: "create" | "delete" | "learn" | "unknown" | "error"
      - reply: texto a responder al usuario
      - missing: list[str] (campos que faltan para completar un create)
      - tx_id: int | None (id de la tx creada/borrada cuando aplica)
      - new_history: list[dict] (historial actualizado, recortado a MAX_HISTORY_TURNS)

    No hace I/O del transporte (no envía mensajes). El llamador decide qué hacer
    con `reply` y, si hay `missing`, persiste el `new_history` donde corresponda.
    """
    history = history or []

    cats = crud.list_categories(db, owner_id)
    cats_gasto = [c.name for c in cats if c.kind == "gasto"]
    cats_ingreso = [c.name for c in cats if c.kind == "ingreso"]
    mediums = [m.name for m in crud.list_mediums(db, owner_id)]
    tarjetas = crud.list_tarjetas(db, owner_id)
    bot_rules = [
        {"keyword": r.keyword, "cat": r.cat, "tx_type": r.tx_type}
        for r in crud.list_bot_rules(db)
    ]
    recent = [crud.serialize_tx(t) for t in crud.list_transactions(db, owner_id)[:10]]

    result = await parse_message(
        text, cats_gasto, cats_ingreso, mediums, recent,
        bot_rules=bot_rules, history=history,
        thinking_budget=0 if fast else 1024,
        timeout=7.0 if fast else 45.0,
    )
    if result is None:
        return {
            "intent": "error",
            "reply": messages.GEMINI_ERROR,
            "missing": [],
            "tx_id": None,
            "new_history": history,
        }

    intent = result.get("intent", "unknown")
    reply = (result.get("reply") or "").strip() or messages.NOT_UNDERSTOOD_GENERIC

    if intent == "unknown":
        return {"intent": "unknown", "reply": reply, "missing": [], "tx_id": None, "new_history": []}

    if intent == "learn":
        keyword = (result.get("rule_keyword") or "").strip()
        cat = (result.get("rule_cat") or "").strip()
        rule_tx_type = (result.get("rule_tx_type") or "g").strip()
        if keyword and cat:
            crud.save_bot_rule(db, keyword, cat, rule_tx_type)
            logger.info("[bot] regla guardada: '%s' → %s (%s)", keyword, cat, rule_tx_type)
        return {"intent": "learn", "reply": reply, "missing": [], "tx_id": None, "new_history": []}

    if intent == "delete":
        tx_id = result.get("tx_id")
        if not tx_id or not crud.delete_transaction(db, tx_id, owner_id):
            return {
                "intent": "delete", "reply": messages.NOT_FOUND_DELETE,
                "missing": [], "tx_id": None, "new_history": [],
            }
        return {"intent": "delete", "reply": reply, "missing": [], "tx_id": tx_id, "new_history": []}

    # intent == "create"
    missing = result.get("missing") or []
    new_history = (history + [
        {"role": "user", "text": text},
        {"role": "model", "text": reply},
    ])[-MAX_HISTORY_TURNS:]

    if missing:
        return {
            "intent": "create", "reply": reply, "missing": missing,
            "tx_id": None, "new_history": new_history,
        }

    tx = _persist(db, result, tarjetas, owner_id, source)
    return {"intent": "create", "reply": reply, "missing": [], "tx_id": tx.id, "new_history": []}
