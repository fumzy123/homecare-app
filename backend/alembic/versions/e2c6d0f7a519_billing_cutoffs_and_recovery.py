"""Seal usage at correction deadlines and track verified invoice coverage."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "e2c6d0f7a519"
down_revision = "d1b5c9e6f408"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("organizations", sa.Column("billing_usage_tracking_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organizations", sa.Column("billing_recovery_checked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organizations", sa.Column("billing_recovery_error", sa.String(), nullable=True))
    op.add_column("billing_periods", sa.Column("source_invoice_id", sa.String(), nullable=True))
    op.add_column("billing_periods", sa.Column("source_invoice_line_id", sa.String(), nullable=True))
    op.create_table("billing_usage_cutoffs",
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), primary_key=True),
        sa.Column("subscription_id", sa.String(), primary_key=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("agency_timezone", sa.String(), nullable=False),
        sa.Column("state", sa.String(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("clients", sa.JSON(), nullable=True),
    )
    # SQLAlchemy's backend role owns data access; no Data API exposure.
    op.execute("ALTER TABLE billing_usage_cutoffs ENABLE ROW LEVEL SECURITY")


def downgrade():
    op.drop_table("billing_usage_cutoffs")
    op.drop_column("billing_periods", "source_invoice_line_id")
    op.drop_column("billing_periods", "source_invoice_id")
    op.drop_column("organizations", "billing_recovery_error")
    op.drop_column("organizations", "billing_recovery_checked_at")
    op.drop_column("organizations", "billing_usage_tracking_started_at")
