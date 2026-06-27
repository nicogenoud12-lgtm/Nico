"""Tests de la lógica conversacional compartida (`bot_core`) y los helpers de
Alexa, sin llamar a Gemini ni a la red.

`parse_message` se mockea para devolver la salida estructurada que daría Gemini;
así se prueba el branch por intent + persistencia con una DB SQLite en memoria.
"""
import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import bot_core, models
from app.database import Base
from app.routers import alexa


def _make_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    user = models.User(username="owner", password_hash="x", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    db.add(models.Category(user_id=user.id, name="Comida", kind="gasto"))
    db.add(models.Medium(user_id=user.id, name="Contado"))
    db.commit()
    return db, user.id


def _patch_parse(monkeypatch, result, captured=None):
    async def fake_parse(*args, **kwargs):
        if captured is not None:
            captured.update(kwargs)
        return result
    monkeypatch.setattr(bot_core, "parse_message", fake_parse)


# ── handle_conversation ─────────────────────────────────────────
def test_create_persiste_la_tx(monkeypatch):
    db, owner_id = _make_db()
    captured = {}
    _patch_parse(monkeypatch, {
        "intent": "create", "tx_type": "g", "amt": 10000, "cat": "Comida",
        "medio": "Contado", "desc": "hamburguesa",
        "reply": "Listo, anoté $10.000 en Comida 🍔",
    }, captured)

    res = asyncio.run(bot_core.handle_conversation(
        db, owner_id, "gasté 10 mil en hamburguesa", [], source="alexa", fast=True,
    ))

    assert res["intent"] == "create"
    assert res["missing"] == []
    assert res["tx_id"] is not None
    # fast=True → Gemini sin thinking y timeout corto (límite de 8s de Alexa)
    assert captured["thinking_budget"] == 0
    assert captured["timeout"] == 7.0

    txs = db.query(models.Transaction).all()
    assert len(txs) == 1
    assert txs[0].amt == 10000
    assert txs[0].source == "alexa"


def test_create_con_missing_no_persiste_y_arma_historial(monkeypatch):
    db, owner_id = _make_db()
    _patch_parse(monkeypatch, {
        "intent": "create", "amt": 10000, "reply": "¿en qué categoría lo anoto?",
        "missing": ["cat"],
    })

    res = asyncio.run(bot_core.handle_conversation(
        db, owner_id, "gasté 10 mil", [], source="alexa", fast=True,
    ))

    assert res["intent"] == "create"
    assert res["missing"] == ["cat"]
    assert res["tx_id"] is None
    assert db.query(models.Transaction).count() == 0
    # historial: turno del usuario + del modelo, para repreguntar
    assert [h["role"] for h in res["new_history"]] == ["user", "model"]


def test_gemini_error_no_persiste(monkeypatch):
    db, owner_id = _make_db()
    _patch_parse(monkeypatch, None)

    res = asyncio.run(bot_core.handle_conversation(
        db, owner_id, "lo que sea", [], source="telegram",
    ))

    assert res["intent"] == "error"
    assert db.query(models.Transaction).count() == 0


def test_telegram_usa_thinking_por_default(monkeypatch):
    db, owner_id = _make_db()
    captured = {}
    _patch_parse(monkeypatch, {"intent": "unknown", "reply": "hola!"}, captured)

    asyncio.run(bot_core.handle_conversation(db, owner_id, "hola", [], source="telegram"))

    assert captured["thinking_budget"] == 1024
    assert captured["timeout"] == 45.0


# ── Helpers de Alexa ────────────────────────────────────────────
def test_build_response_envelope():
    r = alexa.build_response("hola", end_session=False, attributes={"history": []})
    assert r["version"] == "1.0"
    assert r["sessionAttributes"] == {"history": []}
    assert r["response"]["outputSpeech"]["text"] == "hola"
    assert r["response"]["shouldEndSession"] is False


def test_validate_cert_url_acepta_url_valida():
    alexa._validate_cert_url("https://s3.amazonaws.com/echo.api/echo-api-cert.pem")


@pytest.mark.parametrize("url", [
    "http://s3.amazonaws.com/echo.api/cert.pem",      # no https
    "https://evil.com/echo.api/cert.pem",             # host equivocado
    "https://s3.amazonaws.com/malicioso/cert.pem",    # path equivocado
    "https://s3.amazonaws.com:8080/echo.api/cert.pem", # puerto equivocado
])
def test_validate_cert_url_rechaza_urls_malas(url):
    with pytest.raises(HTTPException):
        alexa._validate_cert_url(url)
