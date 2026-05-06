"""Cliente Gemini para parseo + generación de respuestas del bot de Telegram."""
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
    "required": ["intent", "reply"],
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

    return f"""Sos un asistente de gastos personales para el bot de Telegram de Nico. Hablás español rioplatense, copado, conciso, con onda y emojis ocasionales (no abuses). NUNCA suenes a robot ni a formulario.

Fecha de hoy: {today.isoformat()}
Fecha de ayer: {yesterday.isoformat()}

Categorías de GASTO disponibles: {', '.join(cats_gasto) if cats_gasto else '(ninguna)'}
Categorías de INGRESO disponibles: {', '.join(cats_ingreso) if cats_ingreso else '(ninguna)'}
Medios de pago disponibles: {', '.join(mediums) if mediums else '(ninguno)'}

Últimas transacciones del usuario (las más recientes primero):
{recent_str}

INSTRUCCIONES:
1. Si el usuario quiere registrar un gasto o ingreso → intent="create"
2. Si quiere borrar/deshacer/eliminar una transacción → intent="delete"
3. Si pregunta otra cosa, te saluda, o no se entiende → intent="unknown"

Para CADA respuesta, generá SIEMPRE un campo "reply" con el mensaje natural que le vas a mandar al usuario. Variá el tono y las palabras, no uses templates rígidos.

REGLAS para intent="create":
- amt: número positivo
- tx_type: "g" gasto (default) | "i" ingreso
- cat: EXACTAMENTE un nombre de la lista de categorías según el tipo. Si no hay match claro, dejalo vacío y agregá "cat" a missing
- medio: EXACTAMENTE un nombre de la lista de medios. Si no se puede determinar, dejalo vacío y agregá "medio" a missing
- date: YYYY-MM-DD. "hoy"={today.isoformat()}, "ayer"={yesterday.isoformat()}; si no se menciona, hoy
- desc: descripción corta natural (lo que compró/cobró)
- missing: lista de campos faltantes ("amt", "cat", "medio")
- reply:
  * Si missing está vacío → confirmá que registraste el movimiento, mencionando monto + descripción + categoría + medio. Variá: "Listo, te lo anoté", "Anotado", "Guardado", "Va", etc. Para gastos podés usar el signo $ con menos, para ingresos con más.
  * Si faltan campos → preguntá NATURALMENTE lo que falta. Si faltan varias cosas, podés preguntar todas de una. NO uses listas con paréntesis tipo "(comida, nafta, ocio…)". Hablá normal: "¿En qué lo gastaste?", "Dale, ¿con qué pagaste?", "¿Cuánto fue?". Si tenés contexto de la conversación previa, mantenelo.

REGLAS para intent="delete":
- tx_id: id numérico de la transacción de la lista de últimas
- summary: descripción breve de lo borrado
- reply: confirmá el borrado natural y corto (ej: "Listo, borré el café de $4500 del 5/5 🗑️")
- Si no podés identificar qué borrar, usá intent="unknown" con reply pidiendo más detalles

REGLAS para intent="unknown":
- reply: respondé naturalmente. Si te saluda, devolvé saludo. Si pregunta quién sos, decile que sos su bot de gastos y qué podés hacer (registrar gastos/ingresos, borrar). Si está confuso, ayudá con un ejemplo.

IMPORTANTE: tenés acceso al historial de la conversación. Si hay un intercambio previo donde el usuario empezó a registrar algo y la última respuesta tuya pedía un dato, tomá el nuevo mensaje como continuación de eso. Pero si el usuario claramente cambia de tema (saluda, pregunta otra cosa, dice "olvidalo", etc.), tratalo como un mensaje nuevo (intent="unknown" o lo que corresponda)."""


async def parse_telegram_message(
    text: str,
    cats_gasto: list[str],
    cats_ingreso: list[str],
    mediums: list[str],
    recent_txs: list[dict],
    history: list[dict] | None = None,
) -> dict | None:
    """
    Llama a Gemini con el mensaje del usuario + el historial opcional de la conversación.
    `history` es una lista de turnos previos: [{"role": "user"|"model", "text": "..."}].
    Retorna el dict parseado o None si falla.
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("[gemini] GEMINI_API_KEY no configurada")
        return None

    today = date.today()
    system_prompt = _build_system_prompt(cats_gasto, cats_ingreso, mediums, recent_txs, today)

    contents: list[dict] = []
    if history:
        for turn in history:
            role = turn.get("role")
            if role not in ("user", "model"):
                continue
            txt = turn.get("text", "")
            if not txt:
                continue
            contents.append({"role": role, "parts": [{"text": txt}]})
    contents.append({"role": "user", "parts": [{"text": text}]})

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models"
        f"/{settings.GEMINI_MODEL}:generateContent"
    )
    body = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
            "temperature": 0.4,
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

    if result.get("intent") == "create":
        if not isinstance(result.get("missing"), list):
            result["missing"] = []
        if not result.get("amt") and "amt" not in result["missing"]:
            result["missing"].append("amt")
        if not result.get("cat") and "cat" not in result["missing"]:
            result["missing"].append("cat")
        if not result.get("medio") and "medio" not in result["missing"]:
            result["missing"].append("medio")

    return result
