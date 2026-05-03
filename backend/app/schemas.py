from datetime import date
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
    month: str
    date: date
    desc: str
    cat: str
    medio: str
    amt: float
    type: Literal["g", "i"]


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    month: Optional[str] = None
    date: Optional[date] = None
    desc: Optional[str] = None
    cat: Optional[str] = None
    medio: Optional[str] = None
    amt: Optional[float] = None
    type: Optional[Literal["g", "i"]] = None


class TransactionRead(BaseModel):
    id: int
    month: str
    date: date
    desc: str
    cat: str
    medio: str
    amt: float
    type: Literal["g", "i"]
    source: str


# ── Reorder ──────────────────────────────────────────────────
class ReorderPayload(BaseModel):
    ids: list[int]
