"""add_placement_filled_closed_notification_types

Revision ID: 4655fec23123
Revises: a9778fe03a1c
Create Date: 2026-06-12 15:12:36.660827

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '4655fec23123'
down_revision: Union[str, Sequence[str], None] = 'a9778fe03a1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'placement_filled'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'placement_closed'")


def downgrade() -> None:
    # Postgres does not support removing enum values without recreating the type.
    pass
