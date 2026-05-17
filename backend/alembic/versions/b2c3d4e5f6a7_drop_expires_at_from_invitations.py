"""drop expires_at from invitations — computed from invited_at instead

Revision ID: b2c3d4e5f6a7
Revises: f8e9d0c1b2a3
Create Date: 2026-05-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'f8e9d0c1b2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('invitations', 'expires_at')


def downgrade() -> None:
    op.add_column('invitations', sa.Column(
        'expires_at',
        sa.DateTime(timezone=True),
        nullable=True,  # nullable on restore since existing rows won't have a value
    ))
