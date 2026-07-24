"""Ventas de muebles: tablas ventas + venta_pagos

Revision ID: 007
Revises: 006
Create Date: 2026-07-24

"""
from __future__ import annotations

from datetime import datetime
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '007'
down_revision: Union[str, None] = '006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotente: init_db().create_all() puede haber creado las tablas en algún
    # entorno, así que sólo las creamos si no existen.
    conn = op.get_bind()
    existing = set(sa.inspect(conn).get_table_names())

    if "ventas" not in existing:
        op.create_table(
            "ventas",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("user_id", sa.Integer,
                      sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("cliente", sa.String, nullable=False, server_default=""),
            sa.Column("fecha", sa.Date, nullable=False),
            sa.Column("items_json", sa.Text, nullable=False, server_default="[]"),
            sa.Column("costo_fabrica", sa.Float, nullable=True),
            sa.Column("notas", sa.String, nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime, nullable=False, default=datetime.utcnow),
        )
        op.create_index("ix_ventas_user_id", "ventas", ["user_id"])
        op.create_index("ix_ventas_fecha", "ventas", ["fecha"])

    if "venta_pagos" not in existing:
        op.create_table(
            "venta_pagos",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("user_id", sa.Integer,
                      sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("venta_id", sa.Integer,
                      sa.ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False),
            sa.Column("fecha", sa.Date, nullable=False),
            sa.Column("tipo", sa.String, nullable=False),
            sa.Column("monto", sa.Float, nullable=False),
            sa.Column("desc", sa.String, nullable=False, server_default=""),
            sa.Column("medio", sa.String, nullable=False, server_default=""),
            sa.Column("tx_id", sa.Integer,
                      sa.ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False, default=datetime.utcnow),
        )
        op.create_index("ix_venta_pagos_user_id", "venta_pagos", ["user_id"])
        op.create_index("ix_venta_pagos_venta_id", "venta_pagos", ["venta_id"])
        op.create_index("ix_venta_pagos_fecha", "venta_pagos", ["fecha"])


def downgrade() -> None:
    op.drop_table("venta_pagos")
    op.drop_table("ventas")
