"""Freno de intentos en /auth/login (login_throttle + router de auth)."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import login_throttle as lt
from app import models
from app.auth import hash_password
from app.database import Base, get_db
from app.routers import auth as auth_router


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    lt._fallos.clear()
    monkeypatch.setattr("app.auth.settings.JWT_SECRET", "test-secret")
    yield
    lt._fallos.clear()


@pytest.fixture
def reloj(monkeypatch):
    t = {"now": 1000.0}
    monkeypatch.setattr(lt.time, "monotonic", lambda: t["now"])
    return t


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as db:
        db.add(models.User(username="nico", password_hash=hash_password("correcta"), is_admin=True))
        db.commit()

    app = FastAPI()
    app.include_router(auth_router.router)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    return TestClient(app)


def _login(client, password, ip="1.2.3.4"):
    return client.post(
        "/auth/login",
        data={"username": "nico", "password": password},
        headers={"CF-Connecting-IP": ip},
    )


def test_bloquea_tras_max_fallos(client):
    for _ in range(lt.MAX_FALLOS):
        assert _login(client, "mala").status_code == 401
    r = _login(client, "correcta")
    assert r.status_code == 429  # bloqueado aunque ahora la contraseña sea correcta


def test_otra_ip_no_queda_bloqueada(client):
    for _ in range(lt.MAX_FALLOS):
        _login(client, "mala", ip="1.1.1.1")
    assert _login(client, "correcta", ip="2.2.2.2").status_code == 200


def test_login_correcto_limpia_los_fallos(client):
    for _ in range(lt.MAX_FALLOS - 1):
        _login(client, "mala")
    assert _login(client, "correcta").status_code == 200
    for _ in range(lt.MAX_FALLOS - 1):
        assert _login(client, "mala").status_code == 401


def test_se_libera_al_pasar_la_ventana(reloj):
    for _ in range(lt.MAX_FALLOS):
        lt.fallo("9.9.9.9")
    with pytest.raises(Exception):
        lt.check("9.9.9.9")
    reloj["now"] += lt.VENTANA + 1
    lt.check("9.9.9.9")  # no levanta


def test_limpieza_libera_ips_viejas(reloj):
    # Muchas IPs distintas con un fallo cada una: al superar el tope, las que
    # ya salieron de la ventana tienen que borrarse para no crecer sin límite.
    for i in range(10_001):
        lt.fallo(f"10.0.{i // 256}.{i % 256}")
    reloj["now"] += lt.VENTANA + 1
    lt.fallo("8.8.8.8")
    assert len(lt._fallos) == 1
