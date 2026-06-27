"""Cliente Gemini para parseo + generación de respuestas del bot de Telegram."""
from __future__ import annotations

import base64
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
            "enum": ["create", "delete", "learn", "unknown"],
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
        "cuotas": {"type": "INTEGER"},
        "missing": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
        },
        "tx_id": {"type": "INTEGER"},
        "summary": {"type": "STRING"},
        "rule_keyword": {"type": "STRING"},
        "rule_cat": {"type": "STRING"},
        "rule_tx_type": {"type": "STRING"},
        "reply": {"type": "STRING"},
    },
    "required": ["intent", "reply"],
}


def _build_system_prompt(
    cats_gasto: list[str],
    cats_ingreso: list[str],
    mediums: list[str],
    recent_txs: list[dict],
    bot_rules: list[dict],
    today: date,
) -> str:
    yesterday = today - timedelta(days=1)

    tx_lines = []
    for tx in recent_txs:
        d = tx["date"]
        if hasattr(d, "isoformat"):
            d = d.isoformat()
        tipo = "ingreso" if tx["type"] == "i" else "gasto"
        tx_lines.append(
            f"  id={tx['id']} fecha={d} {tipo} monto={abs(tx['amount']):.0f}"
            f" cat={tx['cat']} medio={tx['medio']} desc={tx['desc'] or '—'}"
        )
    recent_str = "\n".join(tx_lines) if tx_lines else "  (sin transacciones recientes)"

    rules_str = ""
    if bot_rules:
        rule_lines = [
            f"  \"{r['keyword']}\" → {r['cat']} ({'ingreso' if r['tx_type'] == 'i' else 'gasto'})"
            for r in bot_rules
        ]
        rules_str = "\nREGLAS PERSONALIZADAS DEL USUARIO (aplicálas SIEMPRE que aparezca la keyword):\n" + "\n".join(rule_lines) + "\n"

    return f"""Sos un asistente de gastos personales para el bot de Telegram de Nico. Hablás español rioplatense, copado, conciso, con onda y emojis ocasionales (no abuses). NUNCA suenes a robot ni a formulario.

Fecha de hoy: {today.isoformat()}
Fecha de ayer: {yesterday.isoformat()}

Categorías de GASTO disponibles: {', '.join(cats_gasto) if cats_gasto else '(ninguna)'}
Categorías de INGRESO disponibles: {', '.join(cats_ingreso) if cats_ingreso else '(ninguna)'}
Medios de pago disponibles: {', '.join(mediums) if mediums else '(ninguno)'}
{rules_str}
Últimas transacciones (más recientes primero):
{recent_str}

INSTRUCCIONES:
1. Registrar un gasto o ingreso → intent="create"
2. Borrar/deshacer/eliminar una transacción → intent="delete"
3. Enseñarte una regla (ej: "X es comida", "cuando diga Y usá Nafta", "guardá que Z va en Ropa") → intent="learn"
4. Cualquier otra cosa → intent="unknown"

Para CADA respuesta generá SIEMPRE un campo "reply" con el mensaje natural al usuario. Variá el tono, no uses templates rígidos.

REGLAS para intent="create":
- amt: número positivo
- tx_type: "g" gasto (default) | "i" ingreso
- cat: EXACTAMENTE un nombre de la lista de categorías según el tipo. Aplicá las reglas personalizadas si corresponde. Si no hay match, dejalo vacío y agregá "cat" a missing
- medio: EXACTAMENTE un nombre de la lista de medios. Si no se menciona, usá "Contado". Excepción: si cuotas > 1 y no se mencionó ningún medio/tarjeta, dejalo vacío y agregá "medio" a missing (las compras en cuotas siempre van con tarjeta)
- date: YYYY-MM-DD. "hoy"={today.isoformat()}, "ayer"={yesterday.isoformat()}; si no se menciona, hoy
- desc: descripción corta natural
- cuotas: número entero de cuotas (1 si no se menciona ninguna cuota)
- missing: lista de campos faltantes; solo puede contener "amt" o "cat" (medio ya tiene default)
- reply:
  * Sin missing → confirmá el movimiento mencionando monto + desc + cat + medio. Si cuotas > 1, mencioná las cuotas (ej: "en 6 cuotas de $X"). Variá el texto.
  * Con missing → preguntá naturalmente lo que falta. NO listas con paréntesis. Hablá normal.

REGLAS para intent="delete":
- tx_id: id de la transacción de la lista de últimas
- summary: descripción breve
- reply: confirmá el borrado (ej: "Listo, borré el café de $4500 🗑️")
- Si no podés identificar qué borrar → intent="unknown" con reply pidiendo más detalle

REGLAS para intent="learn":
- rule_keyword: la palabra o frase clave a guardar (tal como la dijo el usuario, en minúsculas)
- rule_cat: EXACTAMENTE un nombre de la lista de categorías de gasto o ingreso
- rule_tx_type: "g" o "i" según el tipo que corresponda
- reply: confirmá que guardaste la regla (ej: "Dale, guardé que 'lutova' va en Comida 📝. La próximo vez la aplico solo.")

REGLAS para intent="unknown":
- reply: respondé naturalmente. Si saluda, devolvé saludo. Si pregunta quién sos, explicá qué podés hacer. Si está confuso, dá un ejemplo.

IMPORTANTE: usás el historial de la conversación. Si el usuario empezó a registrar algo, continuá desde ahí. Si claramente cambia de tema, tratalo como mensaje nuevo."""


async def parse_message(
    text: str,
    cats_gasto: list[str],
    cats_ingreso: list[str],
    mediums: list[str],
    recent_txs: list[dict],
    bot_rules: list[dict] | None = None,
    history: list[dict] | None = None,
    thinking_budget: int = 1024,
    timeout: float = 45.0,
) -> dict | None:
    """
    Llama a Gemini con el mensaje + historial + reglas personalizadas.
    Retorna el dict parseado o None si falla.

    `thinking_budget` y `timeout` permiten una variante rápida (Alexa exige
    respuesta en ~8s): con `thinking_budget=0` Gemini 2.5 Flash responde en 1-4s.
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("[gemini] GEMINI_API_KEY no configurada")
        return None

    today = date.today()
    system_prompt = _build_system_prompt(
        cats_gasto, cats_ingreso, mediums, recent_txs, bot_rules or [], today
    )

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
            "thinkingConfig": {"thinkingBudget": thinking_budget},
        },
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                url,
                params={"key": settings.GEMINI_API_KEY},
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException, httpx.NetworkError) as e:
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
        # Si hay cuotas y no se especificó tarjeta/medio, preguntar
        if int(result.get("cuotas") or 1) > 1 and not result.get("medio") and "medio" not in result["missing"]:
            result["missing"].append("medio")

    return result


# Alias retrocompatible (el nombre viejo se usaba sólo desde telegram.py).
parse_telegram_message = parse_message


# ── Importación de resúmenes de tarjeta en PDF ───────────────────
# REQUIREMENT: extraer movimientos de resúmenes Mercado Pago / Ualá vía Gemini
# (salida estructurada). El PDF se manda nativo como inline_data — sin parser.
STATEMENT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "periodo": {"type": "STRING"},
        "movimientos": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "fecha": {"type": "STRING"},        # YYYY-MM-DD
                    "descripcion": {"type": "STRING"},
                    "monto": {"type": "NUMBER"},          # positivo
                    "moneda": {"type": "STRING", "enum": ["ARS", "USD"]},
                    "tipo": {
                        "type": "STRING",
                        "enum": ["consumo", "impuesto", "pago", "ajuste"],
                    },
                    "cuota_num": {"type": "INTEGER"},
                    "cuota_total": {"type": "INTEGER"},
                    "cat_sugerida": {"type": "STRING"},
                },
                "required": ["fecha", "descripcion", "monto", "moneda", "tipo"],
            },
        },
    },
    "required": ["movimientos"],
}


def _build_statement_prompt(cats_gasto: list[str], emisor_hint: str | None, today: date) -> str:
    cats = ", ".join(cats_gasto) if cats_gasto else "(ninguna)"
    hint = f"\nEl resumen es del emisor: {emisor_hint}." if emisor_hint else ""
    return f"""Sos un extractor de resúmenes de tarjeta de crédito argentinos (Mercado Pago o Ualá).{hint}
Hoy es {today.isoformat()}. El resumen que estás leyendo es reciente (de los últimos meses).
Devolvé TODOS los movimientos del resumen en JSON estructurado. Reglas:

- "tipo":
  * "consumo": una compra/consumo del titular.
  * "impuesto": impuestos, percepciones, IVA, IIBB, impuesto de sellos, intereses de financiación, comisiones. (Todo lo que no sea una compra ni un pago/ajuste.)
  * "pago": pagos del resumen, pagos anticipados, "su pago", acreditaciones de pago.
  * "ajuste": ajustes, reembolsos, reintegros, devoluciones.
- "fecha": SIEMPRE en formato YYYY-MM-DD. Las fechas en el PDF suelen venir sin año (ej. "5/abr", "07/01", "31/ene") o con año de 2 dígitos ("29 JUL 25").
  * INFERÍ el año usando como referencia que hoy es {today.isoformat()}: todo movimiento es del PASADO reciente, nunca del futuro.
  * Elegí el año MÁS RECIENTE que haga que la fecha NO sea posterior a hoy. Ej: si hoy es {today.isoformat()} y la fecha es "07/01", es del {today.year} (no de años anteriores).
  * Una compra en cuotas puede tener su fecha de origen hasta ~12 meses atrás, por lo que como mucho puede caer en el año anterior, pero JAMÁS asignes años viejos (2 o más años atrás) a un resumen reciente.
- "monto": número POSITIVO, sin símbolo de moneda ni separadores de miles.
- "moneda": "ARS" para la columna Pesos, "USD" para la columna Dólares.
- Cuotas: si el consumo está en cuotas, completá "cuota_num" y "cuota_total".
  * Mercado Pago: columna tipo "4 de 6" → cuota_num=4, cuota_total=6.
  * Ualá: cuota embebida en la descripción tipo "(10/12)" → cuota_num=10, cuota_total=12.
  * Cargá SOLO el monto de la cuota de ESTE período, nunca el total del plan.
- "cat_sugerida": sugerí UNA categoría EXACTA de esta lista de gastos del usuario; si ninguna encaja, dejala vacía. Categorías: {cats}
- No inventes movimientos. No incluyas totales, saldos ni resúmenes de cuenta como movimientos."""


async def extract_statement(
    pdf_bytes: bytes,
    cats_gasto: list[str],
    emisor_hint: str | None = None,
) -> dict | None:
    """Manda el PDF a Gemini y devuelve el dict crudo de movimientos (o None).

    No persiste nada. No loguea el contenido del PDF ni del resultado.
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("[gemini] GEMINI_API_KEY no configurada")
        return None

    prompt = _build_statement_prompt(cats_gasto, emisor_hint, date.today())
    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("ascii")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models"
        f"/{settings.GEMINI_MODEL}:generateContent"
    )
    body = {
        "systemInstruction": {"parts": [{"text": prompt}]},
        "contents": [{
            "role": "user",
            "parts": [
                {"inline_data": {"mime_type": "application/pdf", "data": pdf_b64}},
                {"text": "Extraé todos los movimientos de este resumen."},
            ],
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": STATEMENT_SCHEMA,
            "temperature": 0.1,
            "thinkingConfig": {"thinkingBudget": 1024},
        },
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, params={"key": settings.GEMINI_API_KEY}, json=body)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException, httpx.NetworkError) as e:
        logger.error("[gemini] extract_statement HTTP error: %s", e)
        return None

    try:
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError):
        # No logueamos el contenido (datos personales del resumen).
        logger.error("[gemini] extract_statement: respuesta inválida de Gemini")
        return None

    if not isinstance(result.get("movimientos"), list):
        logger.error("[gemini] extract_statement: falta 'movimientos' en la respuesta")
        return None

    return result
