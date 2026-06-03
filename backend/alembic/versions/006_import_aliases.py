"""Alias de nombres al importar resúmenes: tabla import_aliases

Revision ID: 006
Revises: 005
Create Date: 2026-06-03

"""
from __future__ import annotations

from datetime import datetime
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotente: init_db().create_all() puede haber creado la tabla en algún
    # entorno, así que sólo la creamos si no existe.
    conn = op.get_bind()
    if "import_aliases" in set(sa.inspect(conn).get_table_names()):
        return
    op.create_table(
        "import_aliases",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer,
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pattern", sa.String, nullable=False),
        sa.Column("alias", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, default=datetime.utcnow),
        sa.UniqueConstraint("user_id", "pattern", name="uq_import_alias_user_pattern"),
    )
    op.create_index("ix_import_aliases_user_id", "import_aliases", ["user_id"])
    op.create_index("ix_import_aliases_pattern", "import_aliases", ["pattern"])


def downgrade() -> None:
    op.drop_table("import_aliases")
