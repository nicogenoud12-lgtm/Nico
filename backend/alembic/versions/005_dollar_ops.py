"""Caja fuerte de dólares: tabla dollar_ops

Revision ID: 005
Revises: 004
Create Date: 2026-06-02

"""
from __future__ import annotations

from datetime import datetime
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotente: init_db().create_all() puede haber creado la tabla en algún
    # entorno, así que sólo la creamos si no existe.
    conn = op.get_bind()
    if "dollar_ops" in set(sa.inspect(conn).get_table_names()):
        return
    op.create_table(
        "dollar_ops",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer,
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("kind", sa.String, nullable=False),
        sa.Column("usd", sa.Float, nullable=False),
        sa.Column("rate", sa.Float, nullable=True),
        sa.Column("desc", sa.String, nullable=False, server_default=""),
        sa.Column("tx_id", sa.Integer,
                  sa.ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, default=datetime.utcnow),
    )
    op.create_index("ix_dollar_ops_user_id", "dollar_ops", ["user_id"])
    op.create_index("ix_dollar_ops_date", "dollar_ops", ["date"])


def downgrade() -> None:
    op.drop_table("dollar_ops")
