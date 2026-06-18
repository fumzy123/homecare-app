"""add service_type to shifts

Lets a shift record which service it delivers, so delivered/scheduled care can
roll up per service (alongside the per-service authorization and weekly care
plan). Nullable — admins still schedule freely and legacy shifts predate it.

Revision ID: d8e9fab0c1d2
Revises: c7d8e9fab0c1
Create Date: 2026-06-18 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum


revision: str = 'd8e9fab0c1d2'
down_revision: Union[str, Sequence[str], None] = 'c7d8e9fab0c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # servicetype enum already exists (created with authorizations) — reuse it.
    service_type = PgEnum(
        'personal_care', 'companionship', 'respite', 'nursing', 'homemaking',
        name='servicetype', create_type=False,
    )
    op.add_column('shifts', sa.Column('service_type', service_type, nullable=True))


def downgrade() -> None:
    op.drop_column('shifts', 'service_type')
