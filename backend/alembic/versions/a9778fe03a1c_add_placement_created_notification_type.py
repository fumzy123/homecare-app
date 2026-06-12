"""add_placement_created_notification_type

Revision ID: a9778fe03a1c
Revises: c1bbc84a686c
Create Date: 2026-06-12 14:15:08.537701

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9778fe03a1c'
down_revision: Union[str, Sequence[str], None] = 'c1bbc84a686c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'placement_created'")


def downgrade() -> None:
    # Postgres does not support removing enum values without recreating the type.
    pass
