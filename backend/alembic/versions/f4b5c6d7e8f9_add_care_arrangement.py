"""add care_arrangement to clients and uses_authorizations to organizations

Makes the funder authorization an optional, opt-in compliance layer:
- clients.care_arrangement (self_pay | funded) — per-client switch.
- organizations.uses_authorizations — org-level default / feature toggle.

Backfill keeps existing setups intact: any client that already has an
authorization becomes 'funded', and its org turns the feature on. Everyone
else defaults to 'self_pay' (a plain scheduler).

Revision ID: f4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-06-14 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum


revision: str = 'f4b5c6d7e8f9'
down_revision: Union[str, Sequence[str], None] = 'f3a4b5c6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


care_arrangement = PgEnum('self_pay', 'funded', name='carearrangement', create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    care_arrangement.create(bind, checkfirst=True)

    op.add_column(
        'clients',
        sa.Column('care_arrangement', care_arrangement, nullable=False, server_default='self_pay'),
    )
    op.add_column(
        'organizations',
        sa.Column('uses_authorizations', sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Preserve today's setups: a client with any authorization is funded;
    # its org has the authorizations feature on.
    op.execute("""
        UPDATE clients SET care_arrangement = 'funded'
        WHERE id IN (SELECT DISTINCT client_id FROM authorizations)
    """)
    op.execute("""
        UPDATE organizations SET uses_authorizations = true
        WHERE id IN (SELECT DISTINCT org_id FROM authorizations)
    """)


def downgrade() -> None:
    op.drop_column('organizations', 'uses_authorizations')
    op.drop_column('clients', 'care_arrangement')
    care_arrangement.drop(op.get_bind(), checkfirst=True)
