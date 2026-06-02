from datetime import datetime, date

from sqlalchemy import Boolean, Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    is_admin = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True)
    code = Column(String, nullable=False, unique=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    used_at = Column(DateTime, nullable=True)
    used_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    note = Column(String, nullable=True)


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "name", "kind", name="uq_categories_user_name_kind"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False, default="#b0aaaa")
    kind = Column(String, nullable=False, default="gasto")  # gasto | ingreso | inversion
    position = Column(Integer, nullable=False, default=0)


class Medium(Base):
    __tablename__ = "mediums"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_mediums_user_name"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    position = Column(Integer, nullable=False, default=0)


class Month(Base):
    __tablename__ = "months"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    mmyy = Column(String, primary_key=True)  # MMYY, ej "0326"
    label = Column(String, nullable=False)
    short = Column(String, nullable=False)
    saldo_inicial = Column(Float, nullable=False, default=0.0)
    cuotas = Column(Float, nullable=False, default=0.0)


class Tarjeta(Base):
    __tablename__ = "tarjetas"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    nombre = Column(String, nullable=False)
    banco = Column(String, nullable=False, default="")
    ultimos4 = Column(String, nullable=False, default="")
    cierre = Column(String, nullable=False, default="")
    vence = Column(String, nullable=False, default="")
    emisor = Column(String, nullable=True)
    color_idx = Column(Integer, nullable=False, default=0)
    color_hex = Column(String, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    logo_url = Column(String, nullable=True)


class Recurrente(Base):
    __tablename__ = "suscripciones"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
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
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
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
    source = Column(String, nullable=False, default="web")  # web | telegram | import
    # REQUIREMENT: referencia de origen para dedup al importar resúmenes en PDF
    origin_ref = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    category = relationship("Category", lazy="joined")
    medium = relationship("Medium", lazy="joined")
    tarjeta = relationship("Tarjeta", lazy="joined")


class DollarOp(Base):
    """Operación de la caja fuerte de dólares (baúl de tenencias en USD).

    kind: ingreso (+USD, sin pata en pesos) | compra (+USD, pata gasto ARS) |
          venta (-USD, pata ingreso ARS) | retiro (-USD, pata gasto USD).
    La pata linkeada (compra/venta/retiro) es una Transaction normal referenciada
    por tx_id; al borrar la op se borra también esa Transaction (ver crud).
    """
    __tablename__ = "dollar_ops"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    kind = Column(String, nullable=False)          # ingreso | compra | venta | retiro
    usd = Column(Float, nullable=False)            # siempre positivo; el signo lo da kind
    rate = Column(Float, nullable=True)            # cotización ARS/USD (None en ingreso/retiro)
    desc = Column(String, nullable=False, default="")
    tx_id = Column(Integer, ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    tx = relationship("Transaction", lazy="joined", foreign_keys=[tx_id])


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
