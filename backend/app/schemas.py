import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Category ─────────────────────────────────────────────────
class CategoryBase(BaseModel):
    name: str
    color: str = "#b0aaaa"
    kind: Literal["gasto", "ingreso"] = "gasto"


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    kind: Optional[Literal["gasto", "ingreso"]] = None


class CategoryRead(CategoryBase):
    id: int
    position: int

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


# ── Suscripcion ──────────────────────────────────────────────
class SuscripcionBase(BaseModel):
    nombre: str
    monto: float
    moneda: Literal["ARS", "USD"] = "ARS"
    frecuencia: Literal["mensual", "anual"] = "mensual"
    vencimiento: Optional[str] = None
    estado: Literal["activo", "inactivo"] = "activo"
    logo_url: Optional[str] = None


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


class SuscripcionRead(SuscripcionBase):
    id: int
    position: int

    class Config:
        from_attributes = True


# ── Month ────────────────────────────────────────────────────
class MonthRead(BaseModel):
    id: str
    label: str
    short: str
    saldoInicial: float = Field(alias="saldo_inicial")
    cuotas: float

    class Config:
        from_attributes = True
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


class TransactionCreate(TransactionBase):
    month: Optional[str] = None  # derivado de date si no se provee


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
    medio: str
    amount: float
    type: Literal["g", "i"]
    currency: str = "ARS"
    cuota_num: Optional[int] = None
    cuota_total: Optional[int] = None
    tarjeta_id: Optional[int] = None
    source: str


# ── Reorder ──────────────────────────────────────────────────
class ReorderPayload(BaseModel):
    ids: list[int]


# ── Backup ───────────────────────────────────────────────────
class BackupPayload(BaseModel):
    version: int = 1
    exported_at: Optional[str] = None
    categories: list[dict] = []
    mediums: list[dict] = []
    tarjetas: list[dict] = []
    months: list[dict] = []
    transactions: list[dict] = []
