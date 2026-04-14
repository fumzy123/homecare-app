"""Add location to shifts

Revision ID: d4baabe51ab6
Revises: 0801174c56bc
Create Date: 2026-04-14 14:45:29.419522

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4baabe51ab6'
down_revision: Union[str, Sequence[str], None] = '0801174c56bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shifts', sa.Column('location', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('shifts', 'location')
