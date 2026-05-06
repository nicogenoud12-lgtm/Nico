"""Cliente Gemini para parseo de mensajes del bot de Telegram."""
from __future__ import annotations

import json
import logging
from datetime import date, timedelta

import httpx

from .config import settings

logger = logging.getLogger(__name__)

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "intent": {
            "type": "STRING",
            "enum": ["create", "delete", "unknown"],
        },
        "tx_type": {
            "type": "STRING",
            "enum": ["g", "i"],
        },
        "amt": {"type": "NUMBER"},
        "cat": {"type": "STRING"},
        "medio": {"type": "STRING"},
        "desc": {"type": "STRING"},
        "date": {"type": "STRING"},
        "missing": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
        },
        "tx_id": {"type": "INTEGER"},
        "summary": {"type": "STRING"},
        "reply": {"type": "STRING"},
    },
    "required": ["intent"],
}


def _build_system_prompt(
    cats_gasto: list[str],
    cats_ingreso: list[str],
    mediums: list[str],
    recent_txs: list[dict],
    today: date,
) -> str:
    yesterday = today - timedelta(days=1)

    lines = []
    for tx in recent_txs:
        d = tx["date"]
        if hasattr(d, "isoformat"):
            d = d.isoformat()
        tipo = "ingreso" if tx["type"] == "i" else "gasto"
        lines.append(
            f"  id={tx['id']} fecha={d} {tipo} monto={abs(tx['amount']):.0f}"
            f" cat={tx['cat']} medio={tx['medio']} desc={tx['desc'] or '—'}"
        )
    recent_str = "\n".join(lines) if lines else "  (sin transacciones recientes)"

    return f"""Sos un asistente de gastos personales para el bot de Telegram de Nico. Respondé siempre en español rioplatense, amigable y conciso.

Fecha de hoy: {today.isoformat()}
Fecha de ayer: {yesterday.isoformat()}

Categorías de GASTO disponibles: {', '.join(cats_gasto) if cats_gasto else '(ninguna)'}
Categorías de INGRESO disponibles: {', '.join(cats_ingreso) if cats_ingreso else '(ninguna)'}
Medios de pago disponibles: {', '.join(mediums) if mediums else '(ninguno)'}

Últimas transacciones del usuario:
{recent_str}

INSTRUCCIONES:
1. Si el usuario quiere registrar un gasto o ingreso → intent="create"
2. Si el usuario quiere borrar/deshacer/eliminar una transacción → intent="delete"
3. Si no entendés o el mensaje no es sobre finanzas → intent="unknown"

REGLAS para intent="create":
- amt: número positivo (el monto)
- tx_type: "g" para gasto (por defecto), "i" para ingreso
- cat: EXACTAMENTE un nombre de la lista de categorías según el tipo. Si no aplica ninguna, dejalo vacío e incluílo en missing
- medio: EXACTAMENTE un nombre de la lista de medios. Si no se puede determinar, dejalo vacío e incluílo en missing
- date: formato YYYY-MM-DD. "hoy"={today.isoformat()}, "ayer"={yesterday.isoformat()}, sin mención usá hoy
- desc: descripción corta de qué fue el gasto/ingreso
- missing: lista de campos faltantes, pueden ser: "amt", "cat", "medio"

REGLAS para intent="delete":
- tx_id: el id numérico de la transacción de la lista que mejor coincida con lo que pide el usuario
- summary: descripción breve de lo que se va a borrar (ej: "café $4500 del 05/05")
- Si no hay transacciones que coincidan, usá intent="unknown" con un reply explicando

REGLAS para intent="unknown":
- reply: mensaje amigable corto diciendo qué puede hacer (registrar gastos/ingresos, o borrar el último)"""


async def parse_telegram_message(
    text: str,
    cats_gasto: list[str],
    cats_ingreso: list[str],
    mediums: list[str],
    recent_txs: list[dict],
) -> dict | None:
    """
    Parsea un mensaje de Telegram con Gemini.
    Retorna un dict con intent + campos, o None si falla.
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("[gemini] GEMINI_API_KEY no configurada")
        return None

    today = date.today()
    system_prompt = _build_system_prompt(cats_gasto, cats_ingreso, mediums, recent_txs, today)

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models"
        f"/{settings.GEMINI_MODEL}:generateContent"
    )
    body = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": text}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
            "temperature": 0.1,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                params={"key": settings.GEMINI_API_KEY},
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException) as e:
        logger.error("[gemini] HTTP error: %s", e)
        return None

    try:
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        logger.error("[gemini] parse error: %s — raw: %s", e, data)
        return None

    if "intent" not in result:
        logger.error("[gemini] falta 'intent' en respuesta: %s", result)
        return None

    # normalizar missing para intent=create
    if result.get("intent") == "create":
        if not isinstance(result.get("missing"), list):
            result["missing"] = []
        # asegurar que campos vacíos/ausentes queden en missing
        if not result.get("amt") and "amt" not in result["missing"]:
            result["missing"].append("amt")
        if not result.get("cat") and "cat" not in result["missing"]:
            result["missing"].append("cat")
        if not result.get("medio") and "medio" not in result["missing"]:
            result["missing"].append("medio")

    return result
