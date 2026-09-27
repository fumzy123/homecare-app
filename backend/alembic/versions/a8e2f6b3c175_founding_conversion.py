"""Durable founding conversion notices and Stripe schedules."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "a8e2f6b3c175"
down_revision = "f7d1e5a2b064"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'founding_conversion_notice'")
    op.create_table(
        "founding_conversions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), unique=True, nullable=False),
        sa.Column("subscription_id", sa.String(), nullable=False),
        sa.Column("target_price_id", sa.String(), nullable=False),
        sa.Column("target_plan_version", sa.Integer(), nullable=False),
        sa.Column("base_amount_cents", sa.Integer(), nullable=False),
        sa.Column("additional_client_amount_cents", sa.Integer(), nullable=False),
        sa.Column("included_clients", sa.Integer(), nullable=False),
        sa.Column("notice_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("effective_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("schedule_id", sa.String()),
        sa.Column("attempted_at", sa.DateTime(timezone=True)),
        sa.Column("converted_at", sa.DateTime(timezone=True)),
    )


def downgrade():
    op.drop_table("founding_conversions")
    # Keep the additive enum value and published notifications for audit history.
