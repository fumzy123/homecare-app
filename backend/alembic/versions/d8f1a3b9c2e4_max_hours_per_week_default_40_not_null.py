"""max_hours_per_week default 40 and not null

Revision ID: d8f1a3b9c2e4
Revises: 28541c8cfb99
Create Date: 2026-05-23 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8f1a3b9c2e4'
down_revision: Union[str, Sequence[str], None] = '28541c8cfb99'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Backfill any NULL rows so the NOT NULL constraint can be applied.
    op.execute("UPDATE org_members SET max_hours_per_week = 40 WHERE max_hours_per_week IS NULL")
    op.alter_column(
        'org_members',
        'max_hours_per_week',
        existing_type=sa.Integer(),
        nullable=False,
        server_default='40',
    )


def downgrade() -> None:
    op.alter_column(
        'org_members',
        'max_hours_per_week',
        existing_type=sa.Integer(),
        nullable=True,
        server_default=None,
    )
