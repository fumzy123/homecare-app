"""Add schedule grids — availability JSONB on worker_profiles, requested_schedule JSONB on clients

Revision ID: f3a9b2c1d8e7
Revises: d4baabe51ab6
Create Date: 2026-04-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = 'f3a9b2c1d8e7'
down_revision: Union[str, None] = 'd4baabe51ab6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # worker_profiles.availability was a plain Text column used for free-form notes.
    # Clear any existing text values (they can't be cast to JSONB), then switch the type.
    op.execute("UPDATE worker_profiles SET availability = NULL")
    op.alter_column(
        'worker_profiles',
        'availability',
        existing_type=sa.Text(),
        type_=JSONB(),
        existing_nullable=True,
        postgresql_using='availability::jsonb',
    )

    # Add requested_schedule to clients
    op.add_column(
        'clients',
        sa.Column('requested_schedule', JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('clients', 'requested_schedule')

    op.alter_column(
        'worker_profiles',
        'availability',
        existing_type=JSONB(),
        type_=sa.Text(),
        existing_nullable=True,
    )
