"""add legal identity and business address to organizations

Revision ID: 28541c8cfb99
Revises: c1d2e3f4a5b6
Create Date: 2026-05-18 18:25:29.853052

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '28541c8cfb99'
down_revision: Union[str, Sequence[str], None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('legal_name', sa.String(), nullable=True))
    op.add_column('organizations', sa.Column('business_number', sa.String(), nullable=True))
    op.add_column('organizations', sa.Column('street', sa.String(), nullable=True))
    op.add_column('organizations', sa.Column('city', sa.String(), nullable=True))
    op.add_column('organizations', sa.Column('province', sa.String(), nullable=True))
    op.add_column('organizations', sa.Column('postal_code', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'postal_code')
    op.drop_column('organizations', 'province')
    op.drop_column('organizations', 'city')
    op.drop_column('organizations', 'street')
    op.drop_column('organizations', 'business_number')
    op.drop_column('organizations', 'legal_name')
