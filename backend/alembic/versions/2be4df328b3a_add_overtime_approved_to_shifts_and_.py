"""add overtime_approved to shifts and employment_type to invitations

Revision ID: 2be4df328b3a
Revises: e1f2a3b4c5d6
Create Date: 2026-06-01 14:28:11.429404

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '2be4df328b3a'
down_revision: Union[str, Sequence[str], None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shifts', sa.Column('overtime_approved', sa.Boolean(), nullable=True))
    op.add_column('invitations', sa.Column('employment_type', sa.Enum('full_time', 'part_time', 'casual', name='employmenttype', create_type=False), nullable=True))


def downgrade() -> None:
    op.drop_column('invitations', 'employment_type')
    op.drop_column('shifts', 'overtime_approved')
