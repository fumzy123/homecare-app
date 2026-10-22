"""retire service type requirement preserving legacy values

Revision ID: 6783506efc77
Revises: c8a1a667710e
Create Date: 2026-10-21 12:52:06.920240

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6783506efc77'
down_revision: Union[str, Sequence[str], None] = 'c8a1a667710e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Allow new care slots without classification; preserve all existing records."""
    op.alter_column('care_slots', 'service_type', nullable=True)


def downgrade() -> None:
    # Never fabricate a classification for care saved after retirement.
    if op.get_bind().scalar(sa.text('SELECT EXISTS (SELECT 1 FROM care_slots WHERE service_type IS NULL)')):
        raise RuntimeError('Cannot restore the service-type requirement while unclassified care slots exist.')
    op.alter_column('care_slots', 'service_type', nullable=False)
