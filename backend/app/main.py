from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Category, Medium, Month
from .routers import categories, mediums, months, telegram, transactions


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


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Gastos API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)
app.include_router(categories.router)
app.include_router(mediums.router)
app.include_router(months.router)
app.include_router(telegram.router)


@app.get("/health")
def health():
    return {"ok": True}
