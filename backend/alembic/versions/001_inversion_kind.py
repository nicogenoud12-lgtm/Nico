"""Migra categoria Inversiones a kind=inversion

Revision ID: 001
Revises:
Create Date: 2026-05-08

"""
from typing import Sequence, Union

from alembic import op

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE categories SET kind='inversion' WHERE name='Inversiones' AND kind='gasto'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE categories SET kind='gasto' WHERE name='Inversiones' AND kind='inversion'"
    )
