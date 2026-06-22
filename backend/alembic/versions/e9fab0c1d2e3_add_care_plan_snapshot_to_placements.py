"""add care_plan_snapshot to placements

Freezes the client's weekly care plan onto a placement at post time as
structured JSON, so filling generates exactly the schedule that was advertised
— decoupled from any later change to the live care plan. Nullable; placements
posted before this lands simply have no snapshot.

Revision ID: e9fab0c1d2e3
Revises: d8e9fab0c1d2
Create Date: 2026-06-22 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = 'e9fab0c1d2e3'
down_revision: Union[str, Sequence[str], None] = 'd8e9fab0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('placements', sa.Column('care_plan_snapshot', JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('placements', 'care_plan_snapshot')
