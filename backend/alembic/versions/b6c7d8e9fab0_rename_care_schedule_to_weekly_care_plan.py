"""rename care_schedule_blocks to weekly_care_plan_entries

Naming-consistency rename only — no column changes. The "care schedule" concept
is the client's *weekly care plan*, and each row is an *entry* in that plan
(parallel to worker_availability_entries). Renaming the table keeps the
vocabulary identical from the database up through the API and frontend.

Revision ID: b6c7d8e9fab0
Revises: a5b6c7d8e9fa
Create Date: 2026-06-16 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b6c7d8e9fab0'
down_revision: Union[str, Sequence[str], None] = 'a5b6c7d8e9fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table('care_schedule_blocks', 'weekly_care_plan_entries')


def downgrade() -> None:
    op.rename_table('weekly_care_plan_entries', 'care_schedule_blocks')
