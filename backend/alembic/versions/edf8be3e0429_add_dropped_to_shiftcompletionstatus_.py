"""add_dropped_to_shiftcompletionstatus_enum

Revision ID: edf8be3e0429
Revises: cf8a8475406d
Create Date: 2026-04-26 21:52:20.472736

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'edf8be3e0429'
down_revision: Union[str, Sequence[str], None] = 'cf8a8475406d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE shiftcompletionstatus ADD VALUE IF NOT EXISTS 'dropped'")


def downgrade() -> None:
    # Postgres does not support removing enum values; downgrade is a no-op
    pass
