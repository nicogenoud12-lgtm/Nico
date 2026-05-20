"""Reconstruye categories y mediums para eliminar constraints sin user_id

La migración 002 usó batch_alter_table pero no eliminó explícitamente las constraints
viejas UNIQUE(name, kind) en categories y UNIQUE(name) en mediums. SQLite batch mode
las preservó en las tablas reconstruidas, impidiendo que distintos usuarios creen
categorías o medios de pago con el mismo nombre.

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
    # Reconstruir categories — elimina UNIQUE(name, kind) vieja, deja solo UNIQUE(user_id, name, kind)
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

    # Reconstruir mediums — elimina UNIQUE(name) vieja, deja solo UNIQUE(user_id, name)
    op.execute("ALTER TABLE mediums RENAME TO mediums_old")
    op.create_table(
        "mediums",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("user_id", "name", name="uq_mediums_user_name"),
    )
    op.create_index("ix_mediums_user_id", "mediums", ["user_id"])
    op.execute(
        "INSERT INTO mediums (id, user_id, name, position) "
        "SELECT id, user_id, name, position FROM mediums_old"
    )
    op.execute("DROP TABLE mediums_old")


def downgrade() -> None:
    pass
