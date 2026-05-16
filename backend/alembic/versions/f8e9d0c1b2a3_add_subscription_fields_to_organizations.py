"""add subscription fields to organizations

Revision ID: f8e9d0c1b2a3
Revises: 7c0b6a3a61f9
Create Date: 2026-05-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f8e9d0c1b2a3'
down_revision: Union[str, None] = '7c0b6a3a61f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('subscription_id', sa.String(), nullable=True))
    op.add_column('organizations', sa.Column('subscription_status', sa.String(), nullable=True))
    op.add_column('organizations', sa.Column('subscription_current_period_end', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'subscription_current_period_end')
    op.drop_column('organizations', 'subscription_status')
    op.drop_column('organizations', 'subscription_id')
