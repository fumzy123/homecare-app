"""add payment fields to organizations

Revision ID: 7c0b6a3a61f9
Revises: 066be491e454
Create Date: 2026-05-05 00:03:17.079670

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c0b6a3a61f9'
down_revision: Union[str, Sequence[str], None] = '066be491e454'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('organizations', sa.Column('stripe_customer_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'stripe_customer_id')
    op.drop_column('organizations', 'paid_at')
