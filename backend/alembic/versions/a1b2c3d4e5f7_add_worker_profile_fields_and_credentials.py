"""add_worker_profile_fields_and_credentials

Revision ID: a1b2c3d4e5f7
Revises: d9e1f2a3b4c5
Create Date: 2026-05-29

Adds to org_members:
  - employment_status enum (active, on_leave, terminated) replaces is_active
  - pay_rate, languages, pet_tolerance, preferred_client_types

Creates credentials table.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, None] = 'd9e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── New enums ──────────────────────────────────────────────────────────────
    employment_status = postgresql.ENUM(
        'active', 'on_leave', 'terminated',
        name='employmentstatus', create_type=True,
    )
    employment_status.create(op.get_bind(), checkfirst=True)

    credential_category = postgresql.ENUM(
        'safety', 'health', 'emergency_response',
        'transportation', 'eligibility', 'qualification',
        name='credentialcategory', create_type=True,
    )
    credential_category.create(op.get_bind(), checkfirst=True)

    # ── org_members: add new columns ───────────────────────────────────────────
    op.add_column('org_members', sa.Column(
        'employment_status',
        sa.Enum('active', 'on_leave', 'terminated', name='employmentstatus'),
        nullable=True,
    ))

    # Backfill from is_active: active→active, inactive→terminated
    op.execute("""
        UPDATE org_members
        SET employment_status = CASE
            WHEN is_active = TRUE  THEN 'active'::employmentstatus
            WHEN is_active = FALSE THEN 'terminated'::employmentstatus
            ELSE 'active'::employmentstatus
        END
    """)

    # Now make it non-nullable with a default
    op.alter_column('org_members', 'employment_status', nullable=False,
                    server_default='active')

    op.drop_column('org_members', 'is_active')

    op.add_column('org_members', sa.Column('pay_rate', sa.Numeric(10, 2), nullable=True))
    op.add_column('org_members', sa.Column('languages', postgresql.JSONB(), nullable=True))
    op.add_column('org_members', sa.Column('pet_tolerance', sa.String(), nullable=True))
    op.add_column('org_members', sa.Column('preferred_client_types', postgresql.JSONB(), nullable=True))

    # ── credentials table ──────────────────────────────────────────────────────
    op.create_table(
        'credentials',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('org_member_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('org_members.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('category',
                  postgresql.ENUM('safety', 'health', 'emergency_response',
                                  'transportation', 'eligibility', 'qualification',
                                  name='credentialcategory', create_type=False),
                  nullable=True),
        sa.Column('issuer', sa.String(), nullable=True),
        sa.Column('issue_date', sa.Date(), nullable=True),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('file_url', sa.String(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()')),
    )
    op.create_index('ix_credentials_org_member_id', 'credentials', ['org_member_id'])


def downgrade() -> None:
    op.drop_index('ix_credentials_org_member_id', table_name='credentials')
    op.drop_table('credentials')

    op.add_column('org_members', sa.Column('is_active', sa.Boolean(), server_default='true'))
    op.execute("""
        UPDATE org_members
        SET is_active = CASE
            WHEN employment_status = 'active' THEN TRUE
            ELSE FALSE
        END
    """)
    op.alter_column('org_members', 'is_active', nullable=False)

    op.drop_column('org_members', 'preferred_client_types')
    op.drop_column('org_members', 'pet_tolerance')
    op.drop_column('org_members', 'languages')
    op.drop_column('org_members', 'pay_rate')
    op.drop_column('org_members', 'employment_status')

    op.execute("DROP TYPE IF EXISTS credentialcategory")
    op.execute("DROP TYPE IF EXISTS employmentstatus")
