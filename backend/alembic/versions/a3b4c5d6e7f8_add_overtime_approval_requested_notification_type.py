"""add overtime_approval_requested to notificationtype enum

Revision ID: a3b4c5d6e7f8
Revises: 2be4df328b3a
Branch Labels: None
Depends on: None

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, Sequence[str], None] = '2be4df328b3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'overtime_approval_requested'")


def downgrade() -> None:
    # Postgres does not support removing enum values without recreating the type.
    pass
