"""add start_date to placements

The admin sets when the placement's care begins; it's advertised to workers and
drives shift generation on fill (first occurrence on/after the start date).
Nullable — placements posted before this lands have none.

Revision ID: f0c1d2e3f4a5
Revises: e9fab0c1d2e3
Create Date: 2026-06-22 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f0c1d2e3f4a5'
down_revision: Union[str, Sequence[str], None] = 'e9fab0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('placements', sa.Column('start_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('placements', 'start_date')
