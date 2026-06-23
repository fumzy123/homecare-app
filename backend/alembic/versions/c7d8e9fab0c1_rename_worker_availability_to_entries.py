"""rename worker_availability_blocks to worker_availability_entries

Naming-consistency rename only — no column changes. Each row is an *entry* in a
worker's weekly availability, mirroring weekly_care_plan_entries, so the two
parallel concepts read identically from the database up through the API.

Revision ID: c7d8e9fab0c1
Revises: b6c7d8e9fab0
Create Date: 2026-06-16 02:05:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c7d8e9fab0c1'
down_revision: Union[str, Sequence[str], None] = 'b6c7d8e9fab0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table('worker_availability_blocks', 'worker_availability_entries')


def downgrade() -> None:
    op.rename_table('worker_availability_entries', 'worker_availability_blocks')
