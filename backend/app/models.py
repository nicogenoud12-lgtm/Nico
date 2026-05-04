from datetime import datetime, date

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from .database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
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


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    month = Column(String, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    desc = Column(String, nullable=False, default="")
    cat_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    medio_id = Column(Integer, ForeignKey("mediums.id"), nullable=True)
    amt = Column(Float, nullable=False)
    type = Column(String, nullable=False, default="g")  # g | i
    source = Column(String, nullable=False, default="web")  # web | telegram
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    category = relationship("Category", lazy="joined")
    medium = relationship("Medium", lazy="joined")


class PendingTransaction(Base):
    __tablename__ = "pending_transactions"

    chat_id = Column(Integer, primary_key=True)
    partial_json = Column(Text, nullable=False)
    missing_fields = Column(String, nullable=False)  # csv
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
