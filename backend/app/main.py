import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .models import Category, Medium, Month
from .routers import backup, categories, mediums, months, suscripciones, tarjetas, telegram, transactions

log = logging.getLogger(__name__)


# ── Datos iniciales ──────────────────────────────────────────
DEFAULT_CATEGORIES_GASTO = [
    ("Comida", "#e8b86d"), ("Compras", "#7eb8d4"), ("Combustible", "#d4876b"),
    ("Ocio", "#a78bda"), ("Salud", "#6bbf8e"), ("Suscripciones", "#e88ba0"),
    ("Ropa", "#f0c060"), ("Viajes", "#60b4b4"), ("Inversiones", "#5a9cd4"),
    ("Gimnasio", "#88c070"), ("Regalo", "#d490c0"), ("Donación", "#a0c890"),
    ("Art. Higiene", "#80c8c0"), ("Impuestos", "#c8a080"), ("Suplementos", "#98d0a0"),
    ("Peluquería", "#d0a8d0"), ("Otros", "#b0aaaa"),
]
DEFAULT_CATEGORIES_INGRESO = [
    ("Ingresos", "#2d7a52"), ("Fábrica", "#2d7a52"),
]
DEFAULT_MEDIOS = ["Efectivo", "Transferencia", "MP", "MP Crédito", "Naranja X", "Ualá", "Ualá Crédito", "Astropay", "Personal Pay"]
DEFAULT_MONTHS = [
    ("0326", "Marzo 2026", "Mar", 4495051, 0),
    ("0226", "Febrero 2026", "Feb", 4100000, 50000),
    ("0126", "Enero 2026", "Ene", 3800000, 30000),
    ("1225", "Diciembre 2025", "Dic", 3200000, 80000),
]


def _migrate(conn) -> None:
    """Aplica migraciones idempotentes para SQLite sobre bases existentes."""
    # 1. Agregar columnas faltantes en transactions
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

    # 2. Reconstruir tabla `categories` si todavía tiene UNIQUE global sobre name
    # Detectamos buscando un índice auto-creado sobre la columna name
    idx_rows = conn.exec_driver_sql("PRAGMA index_list('categories')").fetchall()
    needs_rebuild = False
    for row in idx_rows:
        # row: (seq, name, unique, origin, partial)
        idx_name = row[1]
        is_unique = bool(row[2])
        if not is_unique:
            continue
        cols_in_idx = [r[2] for r in conn.exec_driver_sql(f"PRAGMA index_info('{idx_name}')").fetchall()]
        # Constraint vieja: UNIQUE solo sobre (name)
        if cols_in_idx == ["name"]:
            needs_rebuild = True
            break
    if needs_rebuild:
        conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
        conn.exec_driver_sql("""
            CREATE TABLE categories_new (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#b0aaaa',
                kind TEXT NOT NULL DEFAULT 'gasto',
                position INTEGER NOT NULL DEFAULT 0,
                CONSTRAINT uq_categories_name_kind UNIQUE (name, kind)
            )
        """)
        conn.exec_driver_sql(
            "INSERT INTO categories_new (id, name, color, kind, position) "
            "SELECT id, name, color, kind, position FROM categories"
        )
        conn.exec_driver_sql("DROP TABLE categories")
        conn.exec_driver_sql("ALTER TABLE categories_new RENAME TO categories")
        conn.exec_driver_sql("PRAGMA foreign_keys=ON")

    # 3. Migrar categoría Inversiones a kind='inversion' (fallback idempotente;
    #    la migración canónica la ejecuta Alembic al iniciar el contenedor)
    conn.exec_driver_sql(
        "UPDATE categories SET kind='inversion' WHERE name='Inversiones' AND kind='gasto'"
    )

    # 4. Agregar columnas de auto-creación en suscripciones
    sus_cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(suscripciones)").fetchall()}
    new_sus_cols = [
        ("dia_mes", "INTEGER"),
        ("auto_create", "INTEGER NOT NULL DEFAULT 0"),
        ("last_run_month", "TEXT"),
    ]
    for name, decl in new_sus_cols:
        if name not in sus_cols:
            conn.exec_driver_sql(f"ALTER TABLE suscripciones ADD COLUMN {name} {decl}")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        _migrate(conn)
    db = SessionLocal()
    try:
        if not db.query(Category).first():
            for pos, (name, color) in enumerate(DEFAULT_CATEGORIES_GASTO):
                db.add(Category(name=name, color=color, kind="gasto", position=pos))
            for pos, (name, color) in enumerate(DEFAULT_CATEGORIES_INGRESO):
                db.add(Category(name=name, color=color, kind="ingreso", position=len(DEFAULT_CATEGORIES_GASTO) + pos))
        if not db.query(Medium).first():
            for pos, name in enumerate(DEFAULT_MEDIOS):
                db.add(Medium(name=name, position=pos))
        if not db.query(Month).first():
            for mid, label, short, saldo, cuotas in DEFAULT_MONTHS:
                db.add(Month(id=mid, label=label, short=short, saldo_inicial=saldo, cuotas=cuotas))
        db.commit()
    finally:
        db.close()


def _recurrentes_job() -> None:
    db = SessionLocal()
    try:
        created = crud.run_recurrentes(db)
        if created:
            log.info("Cron recurrentes: %d transacciones creadas", len(created))
    except Exception:
        log.exception("Error en cron recurrentes")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler = BackgroundScheduler()
    scheduler.add_job(_recurrentes_job, "cron", hour=0, minute=5)
    scheduler.start()
    _recurrentes_job()  # ejecutar al arrancar para recuperar días perdidos
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Gastos API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)
app.include_router(categories.router)
app.include_router(mediums.router)
app.include_router(tarjetas.router)
app.include_router(suscripciones.router)
app.include_router(months.router)
app.include_router(backup.router)
app.include_router(telegram.router)


@app.post("/cron/suscripciones")
def trigger_recurrentes(db: Session = Depends(get_db)):
    created = crud.run_recurrentes(db)
    return {"created": len(created), "transactions": created}


@app.get("/health")
def health():
    return {"ok": True}
