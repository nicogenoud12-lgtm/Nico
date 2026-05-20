"""Reconstruye categories para eliminar la constraint (name, kind) sin user_id

La migración 002 usó batch_alter_table pero no eliminó explícitamente la constraint
vieja UNIQUE(name, kind). SQLite batch mode la preservó en la tabla reconstruida,
impidiendo que distintos usuarios creen categorías con el mismo nombre.

Revision ID: 003
Revises: 002
Create Date: 2026-05-20

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reconstruir categories manualmente para garantizar solo la constraint correcta.
    op.execute("ALTER TABLE categories RENAME TO categories_old")
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("color", sa.String, nullable=False),
        sa.Column("kind", sa.String, nullable=False),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("user_id", "name", "kind", name="uq_categories_user_name_kind"),
    )
    op.create_index("ix_categories_user_id", "categories", ["user_id"])
    op.execute(
        "INSERT INTO categories (id, user_id, name, color, kind, position) "
        "SELECT id, user_id, name, color, kind, position FROM categories_old"
    )
    op.execute("DROP TABLE categories_old")


def downgrade() -> None:
    pass
