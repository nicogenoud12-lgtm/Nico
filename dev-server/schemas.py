"""Pydantic schemas para el dev-server.

Replican el contrato de `backend/app/schemas.py` y agregan campos de features
planificadas (parent_tx_id en transacciones, dia_mes / cat_id / medio_id /
last_run_month / auto_create en suscripciones) para validar el flujo end-to-end
antes de que existan en prod.
"""
import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Category ─────────────────────────────────────────────────
class CategoryBase(BaseModel):
    name: str
    color: str = "#b0aaaa"
    kind: Literal["gasto", "ingreso", "inversion"] = "gasto"


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    kind: Optional[Literal["gasto", "ingreso", "inversion"]] = None


class CategoryRead(CategoryBase):
    id: int
    position: int


# ── Medium ───────────────────────────────────────────────────
class MediumBase(BaseModel):
    name: str


class MediumCreate(MediumBase):
    pass


class MediumUpdate(BaseModel):
    name: Optional[str] = None


class MediumRead(MediumBase):
    id: int
    position: int


# ── Tarjeta ──────────────────────────────────────────────────
class TarjetaBase(BaseModel):
    nombre: str
    banco: str = ""
    ultimos4: str = ""
    cierre: str = ""
    vence: str = ""
    color_idx: int = 0


class TarjetaCreate(TarjetaBase):
    pass


class TarjetaUpdate(BaseModel):
    nombre: Optional[str] = None
    banco: Optional[str] = None
    ultimos4: Optional[str] = None
    cierre: Optional[str] = None
    vence: Optional[str] = None
    color_idx: Optional[int] = None


class TarjetaRead(TarjetaBase):
    id: int
    position: int


# ── Suscripcion / Gasto Recurrente ───────────────────────────
class SuscripcionBase(BaseModel):
    nombre: str
    monto: float
    moneda: Literal["ARS", "USD"] = "ARS"
    frecuencia: Literal["mensual", "anual"] = "mensual"
    vencimiento: Optional[str] = None
    estado: Literal["activo", "inactivo"] = "activo"
    logo_url: Optional[str] = None
    # Campos nuevos para la lógica CRON (forward-looking):
    dia_mes: Optional[int] = None
    cat_id: Optional[int] = None
    medio_id: Optional[int] = None
    tarjeta_id: Optional[int] = None
    auto_create: bool = False
    last_run_month: Optional[str] = None  # MMYY


class SuscripcionCreate(SuscripcionBase):
    pass


class SuscripcionUpdate(BaseModel):
    nombre: Optional[str] = None
    monto: Optional[float] = None
    moneda: Optional[Literal["ARS", "USD"]] = None
    frecuencia: Optional[Literal["mensual", "anual"]] = None
    vencimiento: Optional[str] = None
    estado: Optional[Literal["activo", "inactivo"]] = None
    logo_url: Optional[str] = None
    dia_mes: Optional[int] = None
    cat_id: Optional[int] = None
    medio_id: Optional[int] = None
    tarjeta_id: Optional[int] = None
    auto_create: Optional[bool] = None


class SuscripcionRead(SuscripcionBase):
    id: int
    position: int


# ── Month ────────────────────────────────────────────────────
class MonthRead(BaseModel):
    id: str
    label: str
    short: str
    saldoInicial: float = Field(alias="saldo_inicial")
    cuotas: float

    class Config:
        populate_by_name = True


# ── Transaction ──────────────────────────────────────────────
class TransactionBase(BaseModel):
    date: datetime.date
    desc: str = ""
    cat: str
    medio: str = ""
    amount: float
    type: Literal["g", "i"]
    currency: Literal["ARS", "USD"] = "ARS"
    cuota_num: Optional[int] = None
    cuota_total: Optional[int] = None
    tarjeta_id: Optional[int] = None
    parent_tx_id: Optional[int] = None  # forward-looking: agrupa cuotas


class TransactionCreate(TransactionBase):
    month: Optional[str] = None


class TransactionUpdate(BaseModel):
    date: Optional[datetime.date] = None
    desc: Optional[str] = None
    cat: Optional[str] = None
    medio: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[Literal["g", "i"]] = None
    currency: Optional[Literal["ARS", "USD"]] = None
    cuota_num: Optional[int] = None
    cuota_total: Optional[int] = None
    tarjeta_id: Optional[int] = None


class TransactionRead(BaseModel):
    id: int
    month: str
    date: datetime.date
    desc: str
    cat: str
    cat_kind: str = "gasto"
    medio: str
    amount: float
    type: Literal["g", "i"]
    currency: str = "ARS"
    cuota_num: Optional[int] = None
    cuota_total: Optional[int] = None
    tarjeta_id: Optional[int] = None
    parent_tx_id: Optional[int] = None
    source: str


# ── Bot ──────────────────────────────────────────────────────
class BotGastoIn(BaseModel):
    text: str


class BotGastoOut(BaseModel):
    parsed: dict
    transactions: list[TransactionRead]
    reply: str


# ── Reorder ──────────────────────────────────────────────────
class ReorderPayload(BaseModel):
    ids: list[int]
