from datetime import datetime, date

from sqlalchemy import Boolean, Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("name", "kind", name="uq_categories_name_kind"),)

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False, default="#b0aaaa")
    kind = Column(String, nullable=False, default="gasto")  # gasto | ingreso
    position = Column(Integer, nullable=False, default=0)


class Medium(Base):
    __tablename__ = "mediums"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    position = Column(Integer, nullable=False, default=0)


class Month(Base):
    __tablename__ = "months"

    id = Column(String, primary_key=True)  # MMYY, ej "0326"
    label = Column(String, nullable=False)
    short = Column(String, nullable=False)
    saldo_inicial = Column(Float, nullable=False, default=0.0)
    cuotas = Column(Float, nullable=False, default=0.0)


class Tarjeta(Base):
    __tablename__ = "tarjetas"

    id = Column(Integer, primary_key=True)
    nombre = Column(String, nullable=False)
    banco = Column(String, nullable=False, default="")
    ultimos4 = Column(String, nullable=False, default="")
    cierre = Column(String, nullable=False, default="")
    vence = Column(String, nullable=False, default="")
    color_idx = Column(Integer, nullable=False, default=0)
    position = Column(Integer, nullable=False, default=0)


class Recurrente(Base):
    __tablename__ = "suscripciones"

    id = Column(Integer, primary_key=True)
    nombre = Column(String, nullable=False)
    monto = Column(Float, nullable=False)
    moneda = Column(String, nullable=False, default="ARS")  # ARS | USD
    frecuencia = Column(String, nullable=False, default="mensual")  # mensual | anual
    vencimiento = Column(String, nullable=True)  # YYYY-MM-DD
    estado = Column(String, nullable=False, default="activo")  # activo | inactivo
    logo_url = Column(String, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    dia_mes = Column(Integer, nullable=True)                          # 1-31
    auto_create = Column(Boolean, nullable=False, default=False)
    last_run_month = Column(String, nullable=True)                    # MMYY


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    month = Column(String, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    desc = Column(String, nullable=False, default="")
    cat_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    medio_id = Column(Integer, ForeignKey("mediums.id"), nullable=True)
    tarjeta_id = Column(Integer, ForeignKey("tarjetas.id"), nullable=True)
    amt = Column(Float, nullable=False)
    type = Column(String, nullable=False, default="g")  # g | i
    currency = Column(String, nullable=False, default="ARS")  # ARS | USD
    cuota_num = Column(Integer, nullable=True)
    cuota_total = Column(Integer, nullable=True)
    source = Column(String, nullable=False, default="web")  # web | telegram
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    category = relationship("Category", lazy="joined")
    medium = relationship("Medium", lazy="joined")
    tarjeta = relationship("Tarjeta", lazy="joined")


class PendingTransaction(Base):
    __tablename__ = "pending_transactions"

    chat_id = Column(Integer, primary_key=True)
    partial_json = Column(Text, nullable=False)
    missing_fields = Column(String, nullable=False)  # csv
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class BotRule(Base):
    __tablename__ = "bot_rules"

    keyword = Column(String, primary_key=True)  # normalizado a minúsculas sin acentos
    cat = Column(String, nullable=False)
    tx_type = Column(String, nullable=False, default="g")  # g | i
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
