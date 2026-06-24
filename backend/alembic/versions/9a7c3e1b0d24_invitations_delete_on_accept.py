"""invitations: delete on accept — purge accepted, drop accepted_at, unique live invite

Accepted invites are now deleted on accept (the Employment is the record of the
join), so the table only ever holds pending invites. This:
  1. purges already-accepted rows so they don't linger or collide with the index,
  2. drops the now-unused accepted_at column,
  3. enforces one live invite per (org, email) at the database level.

Revision ID: 9a7c3e1b0d24
Revises: f0c1d2e3f4a5
Create Date: 2026-06-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9a7c3e1b0d24'
down_revision: Union[str, None] = 'f0c1d2e3f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Purge consumed invites — under the new model these no longer exist.
    op.execute("DELETE FROM invitations WHERE accepted_at IS NOT NULL")

    # 2. Drop the now-unused column.
    op.drop_column('invitations', 'accepted_at')

    # 3. One live invite per (org, email), case-insensitive on email.
    op.create_index(
        'uq_invitations_org_email',
        'invitations',
        ['org_id', sa.text('lower(email)')],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('uq_invitations_org_email', table_name='invitations')
    op.add_column('invitations', sa.Column(
        'accepted_at',
        sa.DateTime(timezone=True),
        nullable=True,
    ))
