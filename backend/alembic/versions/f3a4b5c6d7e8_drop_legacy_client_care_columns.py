"""drop_legacy_client_care_columns

Final contract step: the client's care/funding fields now live on
authorizations (service_type, funder) and care_schedule_blocks
(requested_schedule), with care dates derived. Existing data was backfilled
into authorizations in an earlier migration, so these columns are now safe
to drop.

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-06-14 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, ENUM as PgEnum


revision: str = 'f3a4b5c6d7e8'
down_revision: Union[str, Sequence[str], None] = 'e2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('clients', 'requested_schedule')
    op.drop_column('clients', 'funding_source')
    op.drop_column('clients', 'care_end_date')
    op.drop_column('clients', 'care_start_date')
    op.drop_column('clients', 'service_type')


def downgrade() -> None:
    # Best-effort restore (data is not recoverable) — re-added nullable.
    service_type = PgEnum(
        'personal_care', 'companionship', 'respite', 'nursing', 'homemaking',
        name='servicetype', create_type=False,
    )
    op.add_column('clients', sa.Column('service_type', service_type, nullable=True))
    op.add_column('clients', sa.Column('care_start_date', sa.Date(), nullable=True))
    op.add_column('clients', sa.Column('care_end_date', sa.Date(), nullable=True))
    op.add_column('clients', sa.Column('funding_source', sa.String(), nullable=True))
    op.add_column('clients', sa.Column('requested_schedule', JSONB(), nullable=True))
