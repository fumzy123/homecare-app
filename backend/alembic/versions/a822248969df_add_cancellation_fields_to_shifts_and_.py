"""add_cancellation_fields_to_shifts_and_modifications

Revision ID: a822248969df
Revises: edf8be3e0429
Create Date: 2026-04-27 14:52:34.115564

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a822248969df'
down_revision: Union[str, Sequence[str], None] = 'edf8be3e0429'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shifts',
        sa.Column('cancellation_reason', sa.Text(), nullable=True)
    )
    op.add_column('shift_modifications',
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column('shift_modifications',
        sa.Column('cancellation_reason', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('shifts', 'cancellation_reason')
    op.drop_column('shift_modifications', 'cancelled_at')
    op.drop_column('shift_modifications', 'cancellation_reason')
