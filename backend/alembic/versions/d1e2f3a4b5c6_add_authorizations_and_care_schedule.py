"""add_authorizations_and_care_schedule

Revision ID: d1e2f3a4b5c6
Revises: 4655fec23123
Create Date: 2026-06-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM as PgEnum


revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = '4655fec23123'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Existing type (already in the DB) — reference only, never re-create.
service_type = PgEnum(
    'personal_care', 'companionship', 'respite', 'nursing', 'homemaking',
    name='servicetype', create_type=False,
)
# New types — created explicitly below, then referenced with create_type=False
hours_period = PgEnum('per_week', 'bi_weekly', 'per_month', name='hoursperiod', create_type=False)
week_day = PgEnum('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU', name='weekday', create_type=False)


def upgrade() -> None:
    # Extend the existing servicetype enum (column type references are safe in
    # the same transaction — we never use the new value literally here).
    op.execute("ALTER TYPE servicetype ADD VALUE IF NOT EXISTS 'homemaking'")

    # New enum types
    op.execute("CREATE TYPE hoursperiod AS ENUM ('per_week', 'bi_weekly', 'per_month')")
    op.execute("CREATE TYPE weekday AS ENUM ('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU')")

    # ── authorizations ────────────────────────────────────────────────────────
    op.create_table(
        'authorizations',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('org_id', UUID(as_uuid=True), nullable=False),
        sa.Column('client_id', UUID(as_uuid=True), nullable=False),
        sa.Column('funder', sa.String(), nullable=False),
        sa.Column('funder_file_number', sa.String(), nullable=True),
        sa.Column('authorization_number', sa.String(), nullable=False),
        sa.Column('covering_start', sa.Date(), nullable=False),
        sa.Column('covering_end', sa.Date(), nullable=True),
        sa.Column('date_issued', sa.Date(), nullable=True),
        sa.Column('authorized_by', sa.String(), nullable=True),
        sa.Column('hours_period', hours_period, nullable=False),
        sa.Column('client_monthly_contribution_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('invoice_to', sa.Text(), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('supersedes_id', UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.ForeignKeyConstraint(['created_by'], ['employments.id']),
        sa.ForeignKeyConstraint(['supersedes_id'], ['authorizations.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── authorization_services ────────────────────────────────────────────────
    op.create_table(
        'authorization_services',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('authorization_id', UUID(as_uuid=True), nullable=False),
        sa.Column('service_type', service_type, nullable=False),
        sa.Column('authorized_hours', sa.Numeric(6, 2), nullable=False),
        sa.ForeignKeyConstraint(['authorization_id'], ['authorizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('authorization_id', 'service_type', name='uq_authorization_service'),
    )

    # ── care_schedule_blocks ──────────────────────────────────────────────────
    op.create_table(
        'care_schedule_blocks',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('client_id', UUID(as_uuid=True), nullable=False),
        sa.Column('day_of_week', week_day, nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('service_type', service_type, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # RLS — enable only (backend bypasses via a privileged role; same pattern as
    # the rest of the schema). Satisfies the Supabase advisor.
    op.execute("ALTER TABLE authorizations ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE authorization_services ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE care_schedule_blocks ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table('care_schedule_blocks')
    op.drop_table('authorization_services')
    op.drop_table('authorizations')
    op.execute("DROP TYPE weekday")
    op.execute("DROP TYPE hoursperiod")
    # Postgres cannot remove an enum value, so 'homemaking' stays on servicetype.
