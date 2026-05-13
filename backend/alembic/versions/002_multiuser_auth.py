"""Autenticación multi-usuario: tablas users/invitations, user_id en tablas scoped, rebuild months

Revision ID: 002
Revises: 001
Create Date: 2026-05-13

"""
from __future__ import annotations

from datetime import datetime
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCOPED_TABLES = ["categories", "mediums", "tarjetas", "suscripciones", "transactions"]


def upgrade() -> None:
    # ── 1. Crear tabla users ──────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String, nullable=False, unique=True),
        sa.Column("password_hash", sa.String, nullable=False),
        sa.Column("is_admin", sa.Boolean, nullable=False, default=False),
        sa.Column("is_active", sa.Boolean, nullable=False, default=True),
        sa.Column("created_at", sa.DateTime, nullable=False, default=datetime.utcnow),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    # Seed del admin (user_id=1). Password inválido — usar scripts/set_admin_password.py
    op.execute(
        "INSERT INTO users (id, username, password_hash, is_admin, is_active, created_at) "
        "VALUES (1, 'admin', '!invalid_run_set_admin_password_py', 1, 1, CURRENT_TIMESTAMP)"
    )

    # ── 2. Crear tabla invitations ────────────────────────────
    op.create_table(
        "invitations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("code", sa.String, nullable=False, unique=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, default=datetime.utcnow),
        sa.Column("expires_at", sa.DateTime, nullable=True),
        sa.Column("used_at", sa.DateTime, nullable=True),
        sa.Column("used_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("note", sa.String, nullable=True),
    )
    op.create_index("ix_invitations_code", "invitations", ["code"], unique=True)

    # ── 3. Agregar user_id (nullable) a tablas scoped ─────────
    for table in SCOPED_TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column("user_id", sa.Integer, nullable=True))

    # ── 4. Backfill: asignar todos los datos existentes al admin ─
    for table in SCOPED_TABLES:
        op.execute(f"UPDATE {table} SET user_id = 1 WHERE user_id IS NULL")

    # ── 5. Hacer NOT NULL + FKs + nuevas unique constraints ───

    # categories: drop UniqueConstraint vieja, crear nueva
    with op.batch_alter_table("categories") as batch_op:
        batch_op.alter_column("user_id", nullable=False)
        batch_op.create_foreign_key(
            "fk_categories_user", "users", ["user_id"], ["id"],
            ondelete="CASCADE",
        )
        # La constraint vieja "uq_categories_name_kind" se pierde en el rebuild de batch;
        # crear la nueva constraint compuesta
        batch_op.create_unique_constraint(
            "uq_categories_user_name_kind", ["user_id", "name", "kind"]
        )

    # mediums: drop unique vieja sobre name, crear (user_id, name)
    with op.batch_alter_table("mediums") as batch_op:
        batch_op.alter_column("user_id", nullable=False)
        batch_op.create_foreign_key(
            "fk_mediums_user", "users", ["user_id"], ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_unique_constraint("uq_mediums_user_name", ["user_id", "name"])

    # tarjetas
    with op.batch_alter_table("tarjetas") as batch_op:
        batch_op.alter_column("user_id", nullable=False)
        batch_op.create_foreign_key(
            "fk_tarjetas_user", "users", ["user_id"], ["id"],
            ondelete="CASCADE",
        )

    # suscripciones
    with op.batch_alter_table("suscripciones") as batch_op:
        batch_op.alter_column("user_id", nullable=False)
        batch_op.create_foreign_key(
            "fk_suscripciones_user", "users", ["user_id"], ["id"],
            ondelete="CASCADE",
        )

    # transactions
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.alter_column("user_id", nullable=False)
        batch_op.create_foreign_key(
            "fk_transactions_user", "users", ["user_id"], ["id"],
            ondelete="CASCADE",
        )
    op.create_index("ix_transactions_user_date", "transactions", ["user_id", "date"])

    # ── 6. Rebuild months con PK compuesta (user_id, mmyy) ───
    op.execute("ALTER TABLE months RENAME TO months_old")
    op.create_table(
        "months",
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("mmyy", sa.String, primary_key=True),
        sa.Column("label", sa.String, nullable=False),
        sa.Column("short", sa.String, nullable=False),
        sa.Column("saldo_inicial", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("cuotas", sa.Float, nullable=False, server_default="0.0"),
    )
    op.execute(
        "INSERT INTO months (user_id, mmyy, label, short, saldo_inicial, cuotas) "
        "SELECT 1, id, label, short, saldo_inicial, cuotas FROM months_old"
    )
    op.execute("DROP TABLE months_old")


def downgrade() -> None:
    # Rebuild months de vuelta a PK simple
    op.execute("ALTER TABLE months RENAME TO months_new")
    op.create_table(
        "months",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("label", sa.String, nullable=False),
        sa.Column("short", sa.String, nullable=False),
        sa.Column("saldo_inicial", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("cuotas", sa.Float, nullable=False, server_default="0.0"),
    )
    op.execute(
        "INSERT INTO months (id, label, short, saldo_inicial, cuotas) "
        "SELECT mmyy, label, short, saldo_inicial, cuotas FROM months_new WHERE user_id = 1"
    )
    op.execute("DROP TABLE months_new")

    # Quitar user_id de tablas scoped
    for table in SCOPED_TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_column("user_id")

    op.drop_table("invitations")
    op.drop_table("users")
