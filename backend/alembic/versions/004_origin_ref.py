"""Agrega transactions.origin_ref para dedup de import de resúmenes en PDF

Revision ID: 004
Revises: 003
Create Date: 2026-05-31

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotente: init_db()._migrate() puede haber agregado la columna en algún
    # entorno, así que sólo la creamos si no existe.
    conn = op.get_bind()
    cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(transactions)").fetchall()}
    if "origin_ref" not in cols:
        op.execute("ALTER TABLE transactions ADD COLUMN origin_ref VARCHAR")
        op.create_index("ix_transactions_origin_ref", "transactions", ["origin_ref"])


def downgrade() -> None:
    pass
