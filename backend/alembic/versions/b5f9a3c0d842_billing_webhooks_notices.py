"""Durable webhook receipts and deduplicated billing notifications."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "b5f9a3c0d842"
down_revision = "a4e8f2b9c731"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("billing_webhooks",
        sa.Column("event_id", sa.String(), primary_key=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("object_id", sa.String(), nullable=False),
        sa.Column("customer_id", sa.String(), nullable=False),
        sa.Column("livemode", sa.Boolean(), nullable=False),
        sa.Column("state", sa.String(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_token", UUID(as_uuid=True)),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("error_code", sa.String()),
    )
    op.create_index("ix_billing_webhook_work", "billing_webhooks", ["state", "next_attempt_at"])
    op.create_table("billing_notices",
        sa.Column("key", sa.String(), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("notification_id", UUID(as_uuid=True), sa.ForeignKey("notifications.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_billing_notices_org_id", "billing_notices", ["org_id"])
    op.execute("ALTER TABLE billing_webhooks ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE billing_notices ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'billing_trial_reminder'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'billing_payment_failed'")


def downgrade():
    op.drop_table("billing_notices")
    op.drop_table("billing_webhooks")
    # PostgreSQL enum labels are additive; removing them requires rebuilding the type.
