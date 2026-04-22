"""add supabase_user_id to invitations

Revision ID: cf8a8475406d
Revises: 95bc617edbe7
Create Date: 2026-04-22 10:36:39.936986

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'cf8a8475406d'
down_revision: Union[str, Sequence[str], None] = '95bc617edbe7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('invitations', sa.Column('supabase_user_id', UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column('invitations', 'supabase_user_id')
