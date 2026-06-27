"""
Webhook de la Alexa Skill "Gastos" (conversacional con Gemini).

Adaptador de transporte para el protocolo Alexa Skills Kit (ASK). Opera en nombre
del owner (TELEGRAM_BOT_OWNER_ID) y delega el entendimiento/persistencia a
`bot_core.handle_conversation` (variante `fast`: Alexa exige responder en ~8s).

El historial conversacional (para repreguntar campos faltantes) viaja en
`session.attributes` de Alexa — no se usa la tabla `PendingTransaction`.

Seguridad: el endpoint es público y escribe en la DB, así que se valida la firma
de Amazon (cert chain + RSA/SHA1 sobre el body crudo), el timestamp del request
(anti-replay) y el applicationId de la skill.
"""
from __future__ import annotations

import base64
import logging
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.x509.oid import ExtensionOID
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from ..bot_core import handle_conversation
from ..config import settings
from ..database import get_db
from ..models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alexa", tags=["alexa"])

TIMESTAMP_TOLERANCE_SEC = 150
SLOT_NAME = "frase"
INTENT_NAME = "RegistrarGastoIntent"

LAUNCH_PROMPT = "Dale, decime el gasto o ingreso."
HELP_TEXT = (
    "Decime cosas como: gasté diez mil pesos en una hamburguesa, "
    "o cobré el sueldo. Lo anoto solo. ¿Qué querés registrar?"
)
ERROR_TEXT = "Uy, no te entendí. Probá de nuevo."

# Cache del cert chain por URL (los certs de Amazon se reusan mucho).
_cert_cache: dict[str, x509.Certificate] = {}


# ── Validación de firma de Amazon ────────────────────────────────
def _validate_cert_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise HTTPException(400, "cert url: scheme inválido")
    if (parsed.hostname or "").lower() != "s3.amazonaws.com":
        raise HTTPException(400, "cert url: host inválido")
    if (parsed.port or 443) != 443:
        raise HTTPException(400, "cert url: puerto inválido")
    if not parsed.path.startswith("/echo.api/"):
        raise HTTPException(400, "cert url: path inválido")


async def _load_cert(url: str) -> x509.Certificate:
    if url in _cert_cache:
        return _cert_cache[url]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        cert = x509.load_pem_x509_certificates(resp.content)[0]
    except (httpx.HTTPError, ValueError, IndexError) as e:
        logger.error("[alexa] no se pudo cargar el cert: %s", e)
        raise HTTPException(400, "cert chain inválido")

    now = datetime.now(timezone.utc)
    not_before = getattr(cert, "not_valid_before_utc", None) or cert.not_valid_before.replace(tzinfo=timezone.utc)
    not_after = getattr(cert, "not_valid_after_utc", None) or cert.not_valid_after.replace(tzinfo=timezone.utc)
    if not (not_before <= now <= not_after):
        raise HTTPException(400, "cert vencido o aún no válido")

    try:
        san = cert.extensions.get_extension_for_oid(ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
        dns_names = san.value.get_values_for_type(x509.DNSName)
    except x509.ExtensionNotFound:
        dns_names = []
    if "echo-api.amazon.com" not in dns_names:
        raise HTTPException(400, "cert sin SAN echo-api.amazon.com")

    _cert_cache[url] = cert
    return cert


async def _verify_signature(body: bytes, cert_url: str | None, signature: str | None) -> None:
    if not cert_url or not signature:
        raise HTTPException(400, "faltan headers de firma")
    _validate_cert_url(cert_url)
    cert = await _load_cert(cert_url)
    try:
        sig = base64.standard_b64decode(signature)
        cert.public_key().verify(sig, body, padding.PKCS1v15(), hashes.SHA1())
    except Exception:  # InvalidSignature u otros
        raise HTTPException(400, "firma inválida")


def _validate_timestamp(req: dict) -> None:
    ts = (req.get("request") or {}).get("timestamp")
    if not ts:
        raise HTTPException(400, "falta timestamp")
    try:
        when = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, "timestamp inválido")
    delta = abs((datetime.now(timezone.utc) - when).total_seconds())
    if delta > TIMESTAMP_TOLERANCE_SEC:
        raise HTTPException(400, "timestamp fuera de rango")


def _validate_app_id(req: dict) -> None:
    if not settings.ALEXA_SKILL_ID:
        return  # sin skill id configurado no validamos (dev)
    app_id = (
        ((req.get("session") or {}).get("application") or {}).get("applicationId")
        or (((req.get("context") or {}).get("System") or {}).get("application") or {}).get("applicationId")
    )
    if app_id != settings.ALEXA_SKILL_ID:
        raise HTTPException(401, "applicationId no autorizado")


# ── Adaptación de texto para voz ─────────────────────────────────
def _adapt_for_speech(text: str) -> str:
    """Convierte el reply de Gemini (formato texto) a algo que Alexa lea bien."""
    # "US$ 20" / "U$S 20" / "USD 20" → "20 dólares" (antes de ARS para que no matchee el $)
    def _usd(m):
        num = m.group("num").replace(".", "")
        return f"{num} dólares"
    text = re.sub(r"(?:US\$|U\$S|USD)\s?(?P<num>\d[\d.]*)", _usd, text)

    # "$10.000" / "−$10.000" / "$ 10.000" → "10000 pesos"
    def _ars(m):
        num = m.group("num").replace(".", "")
        return f"{num} pesos"
    text = re.sub(r"[−\-]?\$\s?(?P<num>\d[\d.]*)", _ars, text)

    # Quitar emojis comunes que Alexa leería raro
    text = re.sub(r"[^\w\s.,;:!?¿¡()'\"\-/áéíóúñü]", "", text, flags=re.UNICODE)

    # Limpiar espacios duplicados
    text = re.sub(r"  +", " ", text).strip()

    return text


# ── Armado de la respuesta de Alexa ──────────────────────────────
def build_response(text: str, end_session: bool, attributes: dict | None = None) -> dict:
    return {
        "version": "1.0",
        "sessionAttributes": attributes or {},
        "response": {
            "outputSpeech": {"type": "PlainText", "text": text},
            "shouldEndSession": end_session,
        },
    }


def _get_bot_owner(db: Session) -> User:
    if not settings.TELEGRAM_BOT_OWNER_ID:
        raise HTTPException(503, "TELEGRAM_BOT_OWNER_ID no configurado")
    user = db.get(User, settings.TELEGRAM_BOT_OWNER_ID)
    if not user or not user.is_active:
        raise HTTPException(503, "Bot owner no encontrado o inactivo")
    return user


# ── Webhook ──────────────────────────────────────────────────────
@router.post("/webhook", status_code=200)
async def alexa_webhook(
    request: Request,
    db: Session = Depends(get_db),
    signaturecertchainurl: str | None = Header(default=None),
    signature: str | None = Header(default=None),
):
    body = await request.body()
    await _verify_signature(body, signaturecertchainurl, signature)
    payload = await request.json()
    _validate_timestamp(payload)
    _validate_app_id(payload)

    req = payload.get("request") or {}
    req_type = req.get("type")

    if req_type == "SessionEndedRequest":
        return build_response("", True)

    if req_type == "LaunchRequest":
        return build_response(LAUNCH_PROMPT, False)

    if req_type != "IntentRequest":
        return build_response(ERROR_TEXT, False)

    intent = req.get("intent") or {}
    intent_name = intent.get("name", "")

    if intent_name in ("AMAZON.StopIntent", "AMAZON.CancelIntent"):
        return build_response("Listo, chau.", True)
    if intent_name == "AMAZON.HelpIntent" or intent_name == "AMAZON.FallbackIntent":
        return build_response(HELP_TEXT, False)

    if intent_name != INTENT_NAME:
        return build_response(ERROR_TEXT, False)

    slots = intent.get("slots") or {}
    text = ((slots.get(SLOT_NAME) or {}).get("value") or "").strip()
    if not text:
        return build_response(HELP_TEXT, False)

    history = ((payload.get("session") or {}).get("attributes") or {}).get("history") or []

    owner = _get_bot_owner(db)
    res = await handle_conversation(db, owner.id, text, history, source="alexa", fast=True)

    reply = _adapt_for_speech(res["reply"])

    # create con campos faltantes → repreguntar manteniendo la sesión + historial
    if res["intent"] == "create" and res["missing"]:
        return build_response(reply, False, {"history": res["new_history"]})

    if res["intent"] == "error":
        return build_response(reply, False)

    # create/delete/learn/unknown resueltos → cerrar la sesión
    return build_response(reply, True)
