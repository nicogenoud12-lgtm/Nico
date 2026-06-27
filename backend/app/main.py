import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .models import Category, Medium, Month, User
from .routers import alexa, backup, categories, dollar, mediums, months, recurrentes, tarjetas, telegram, transactions
from .routers import auth as auth_router
from .routers import import_statements

log = logging.getLogger(__name__)


# ── Datos iniciales por usuario ──────────────────────────────
DEFAULT_CATEGORIES_GASTO = [
    ("Art. Higiene", "#80c8c0"), ("Combustible", "#d4876b"), ("Comida", "#e8b86d"),
    ("Gimnasio", "#88c070"), ("Impuestos", "#c8a080"), ("Ocio", "#a78bda"),
    ("Otros", "#b0aaaa"), ("Peluquería", "#d0a8d0"), ("Recurrentes", "#e88ba0"),
    ("Regalo", "#d490c0"), ("Ropa", "#f0c060"), ("Salud", "#6bbf8e"),
    ("Suscripciones", "#e8c060"), ("Tarjeta", "#50c878"), ("Veterinaria", "#70a8d8"),
    ("Viajes", "#60b4b4"),
]
DEFAULT_CATEGORIES_INGRESO = [
    ("Sueldo", "#2d7a52"),
]
DEFAULT_MEDIOS = ["Contado"]
DEFAULT_MONTHS = [
    ("0326", "Marzo 2026", "Mar", 4495051, 0),
    ("0226", "Febrero 2026", "Feb", 4100000, 50000),
    ("0126", "Enero 2026", "Ene", 3800000, 30000),
    ("1225", "Diciembre 2025", "Dic", 3200000, 80000),
]


def seed_defaults_for_user(db: Session, user_id: int) -> None:
    """Siembra categorías, medios y meses default para un usuario nuevo."""
    if not db.query(Category).filter_by(user_id=user_id).first():
        for pos, (name, color) in enumerate(DEFAULT_CATEGORIES_GASTO):
            db.add(Category(name=name, color=color, kind="gasto", position=pos, user_id=user_id))
        for pos, (name, color) in enumerate(DEFAULT_CATEGORIES_INGRESO):
            db.add(Category(
                name=name, color=color, kind="ingreso",
                position=len(DEFAULT_CATEGORIES_GASTO) + pos,
                user_id=user_id,
            ))

    if not db.query(Medium).filter_by(user_id=user_id).first():
        for pos, name in enumerate(DEFAULT_MEDIOS):
            db.add(Medium(name=name, position=pos, user_id=user_id))

    if not db.query(Month).filter_by(user_id=user_id).first():
        for mmyy, label, short, saldo, cuotas in DEFAULT_MONTHS:
            db.add(Month(user_id=user_id, mmyy=mmyy, label=label, short=short,
                         saldo_inicial=saldo, cuotas=cuotas))

    db.commit()


def _migrate(conn) -> None:
    """Migraciones idempotentes para columnas agregadas post-launch (no reconstruye tablas)."""
    cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(transactions)").fetchall()}
    new_tx_cols = [
        ("currency", "TEXT NOT NULL DEFAULT 'ARS'"),
        ("cuota_num", "INTEGER"),
        ("cuota_total", "INTEGER"),
        ("tarjeta_id", "INTEGER"),
    ]
    for name, decl in new_tx_cols:
        if name not in cols:
            conn.exec_driver_sql(f"ALTER TABLE transactions ADD COLUMN {name} {decl}")

    sus_cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(suscripciones)").fetchall()}
    new_sus_cols = [
        ("dia_mes", "INTEGER"),
        ("auto_create", "INTEGER NOT NULL DEFAULT 0"),
        ("last_run_month", "TEXT"),
    ]
    for name, decl in new_sus_cols:
        if name not in sus_cols:
            conn.exec_driver_sql(f"ALTER TABLE suscripciones ADD COLUMN {name} {decl}")

    tarj_cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(tarjetas)").fetchall()}
    if "logo_url" not in tarj_cols:
        conn.exec_driver_sql("ALTER TABLE tarjetas ADD COLUMN logo_url TEXT")
    if "color_hex" not in tarj_cols:
        conn.exec_driver_sql("ALTER TABLE tarjetas ADD COLUMN color_hex TEXT")
    if "emisor" not in tarj_cols:
        conn.exec_driver_sql("ALTER TABLE tarjetas ADD COLUMN emisor TEXT")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        _migrate(conn)


def _recurrentes_job() -> None:
    db = SessionLocal()
    try:
        user_ids = [row[0] for row in db.query(User.id).filter_by(is_active=True).all()]
        for uid in user_ids:
            try:
                created = crud.run_recurrentes(db, uid)
                if created:
                    log.info("Cron recurrentes user=%d: %d txs creadas", uid, len(created))
            except Exception:
                log.exception("Error en cron recurrentes para user=%d", uid)
    except Exception:
        log.exception("Error en cron recurrentes (global)")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if not settings.JWT_SECRET:
        log.warning("⚠️  JWT_SECRET no configurado — la autenticación no funcionará en producción")
    scheduler = BackgroundScheduler()
    scheduler.add_job(_recurrentes_job, "cron", hour=0, minute=5)
    scheduler.start()
    _recurrentes_job()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Gastos API", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(transactions.router)
app.include_router(categories.router)
app.include_router(mediums.router)
app.include_router(tarjetas.router)
app.include_router(recurrentes.router)
app.include_router(months.router)
app.include_router(backup.router)
app.include_router(telegram.router)
app.include_router(alexa.router)
app.include_router(import_statements.router)
app.include_router(dollar.router)


@app.post("/cron/recurrentes")
def trigger_recurrentes():
    _recurrentes_job()
    return {"ok": True}


@app.get("/health")
def health():
    return {"ok": True}
