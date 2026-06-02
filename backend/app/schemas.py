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
    emisor: Optional[str] = None
    ultimos4: str = ""
    cierre: str = ""
    vence: str = ""
    color_idx: int = 0
    color_hex: Optional[str] = None
    logo_url: Optional[str] = None


class TarjetaCreate(TarjetaBase):
    pass


class TarjetaUpdate(BaseModel):
    nombre: Optional[str] = None
    banco: Optional[str] = None
    emisor: Optional[str] = None
    ultimos4: Optional[str] = None
    cierre: Optional[str] = None
    vence: Optional[str] = None
    color_idx: Optional[int] = None
    color_hex: Optional[str] = None
    logo_url: Optional[str] = None


class TarjetaRead(TarjetaBase):
    id: int
    position: int

    class Config:
        from_attributes = True


# ── Recurrente ──────────────────────────────────────────────
class RecurrenteBase(BaseModel):
    nombre: str
    monto: float
    moneda: Literal["ARS", "USD"] = "ARS"
    frecuencia: Literal["mensual", "anual"] = "mensual"
    vencimiento: Optional[str] = None
    estado: Literal["activo", "inactivo"] = "activo"
    logo_url: Optional[str] = None
    dia_mes: Optional[int] = None       # 1-31, día de débito mensual
    auto_create: bool = False


class RecurrenteCreate(RecurrenteBase):
    pass


class RecurrenteUpdate(BaseModel):
    nombre: Optional[str] = None
    monto: Optional[float] = None
    moneda: Optional[Literal["ARS", "USD"]] = None
    frecuencia: Optional[Literal["mensual", "anual"]] = None
    vencimiento: Optional[str] = None
    estado: Optional[Literal["activo", "inactivo"]] = None
    logo_url: Optional[str] = None
    dia_mes: Optional[int] = None
    auto_create: Optional[bool] = None
    last_run_month: Optional[str] = None


class RecurrenteRead(RecurrenteBase):
    id: int
    position: int
    last_run_month: Optional[str] = None

    class Config:
        from_attributes = True


# ── Month ────────────────────────────────────────────────────
class MonthRead(BaseModel):
    id: str = Field(alias="mmyy")
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
    cat_kind: str = "gasto"
    medio: str
    amount: float
    type: Literal["g", "i"]
    currency: str = "ARS"
    cuota_num: Optional[int] = None
    cuota_total: Optional[int] = None
    tarjeta_id: Optional[int] = None
    source: str


# ── Caja fuerte de dólares ───────────────────────────────────
class DollarOpCreate(BaseModel):
    kind: Literal["ingreso", "compra", "venta", "retiro"]
    usd: float
    rate: Optional[float] = None          # requerido en compra/venta
    date: datetime.date
    desc: str = ""
    # Pata linkeada en Movimientos (compra/venta/retiro):
    cat: Optional[str] = None
    medio: str = ""
    tarjeta_id: Optional[int] = None


class DollarOpRead(BaseModel):
    id: int
    date: datetime.date
    kind: Literal["ingreso", "compra", "venta", "retiro"]
    usd: float
    rate: Optional[float] = None
    desc: str
    tx_id: Optional[int] = None
    tx_amount: Optional[float] = None     # monto de la pata linkeada (usd*rate o usd)
    tx_currency: Optional[str] = None     # ARS | USD
    tx_cat: Optional[str] = None
    tx_medio: Optional[str] = None
    created_at: datetime.datetime


class QuoteSide(BaseModel):
    compra: Optional[float] = None
    venta: Optional[float] = None


class QuotesRead(BaseModel):
    oficial: QuoteSide
    cripto: QuoteSide
    fetched_at: Optional[str] = None
    stale: bool = False                   # true si se sirve cache vencido por fallo de API


# ── Reorder ──────────────────────────────────────────────────
class ReorderPayload(BaseModel):
    ids: list[int]


# ── Import de resúmenes de tarjeta (PDF) ─────────────────────
class ImportRow(BaseModel):
    date: datetime.date
    desc: str = ""
    amount: float                       # monto ORIGINAL del resumen (ARS o USD)
    currency: str = "ARS"
    cat: str
    cuota_num: Optional[int] = None
    cuota_total: Optional[int] = None
    origin_ref: str
    rate: Optional[float] = None        # cotización para filas en USD (USD→ARS)


class ImportExtractResponse(BaseModel):
    tarjeta_id: int
    periodo: Optional[str] = None
    rows: list[dict] = []


class ImportConfirm(BaseModel):
    tarjeta_id: int
    rows: list[ImportRow] = []


class ImportConfirmResult(BaseModel):
    created: int
    skipped: int


# ── Backup ───────────────────────────────────────────────────
class BackupPayload(BaseModel):
    version: int = 1
    exported_at: Optional[str] = None
    categories: list[dict] = []
    mediums: list[dict] = []
    tarjetas: list[dict] = []
    months: list[dict] = []
    transactions: list[dict] = []
