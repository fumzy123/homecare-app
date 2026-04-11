"""Add invitations table

Revision ID: 0801174c56bc
Revises: a1b2c3d4e5f6
Create Date: 2026-04-11 18:49:04.815015

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '0801174c56bc'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # orgmemberrole enum already exists — use raw SQL to avoid SQLAlchemy recreating it
    op.execute("""
        CREATE TABLE invitations (
            id UUID PRIMARY KEY,
            email VARCHAR NOT NULL,
            role orgmemberrole NOT NULL,
            org_id UUID NOT NULL REFERENCES organizations(id),
            invited_by UUID NOT NULL REFERENCES org_members(id),
            invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at TIMESTAMPTZ NOT NULL,
            accepted_at TIMESTAMPTZ
        )
    """)


def downgrade() -> None:
    op.drop_table('invitations')
    # ### end Alembic commands ###
