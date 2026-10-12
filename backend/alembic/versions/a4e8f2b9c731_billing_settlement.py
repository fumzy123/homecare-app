"""Durable usage settlement operations and monthly renewal holds."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "a4e8f2b9c731"
down_revision = "f3d7e1a8b620"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("billing_settlements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("source_key", sa.String(), nullable=False, unique=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("period_id", UUID(as_uuid=True), sa.ForeignKey("billing_usage_snapshots.period_id"), nullable=False),
        sa.Column("adjustment_id", UUID(as_uuid=True), sa.ForeignKey("billing_adjustments.id"), nullable=True, unique=True),
        sa.Column("amount_cents", sa.Integer(), nullable=False), sa.Column("currency", sa.String(), nullable=False),
        sa.Column("state", sa.String(), nullable=False), sa.Column("payment_status", sa.String(), nullable=True),
        sa.Column("invoice_id", sa.String(), nullable=True), sa.Column("invoice_line_id", sa.String(), nullable=True),
        sa.Column("context", sa.JSON(), nullable=False), sa.Column("steps", sa.JSON(), nullable=False),
        sa.Column("lease_token", UUID(as_uuid=True), nullable=True), sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("error_code", sa.String(), nullable=True),
    )
    op.create_index("ix_billing_settlement_work", "billing_settlements", ["state", "updated_at"])
    op.create_index("ix_billing_settlement_org_period", "billing_settlements", ["org_id", "period_id"])
    op.create_table("billing_invoice_holds",
        sa.Column("invoice_id", sa.String(), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("subscription_id", sa.String(), nullable=False),
        sa.Column("usage_starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("usage_ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(), nullable=False), sa.Column("base_line_id", sa.String(), nullable=False),
        sa.Column("base_amount_cents", sa.Integer(), nullable=False),
        sa.UniqueConstraint("org_id", "subscription_id", "usage_starts_at", name="uq_billing_invoice_hold_period"),
    )
    op.execute("ALTER TABLE billing_settlements ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE billing_invoice_holds ENABLE ROW LEVEL SECURITY")


def downgrade():
    op.drop_table("billing_invoice_holds")
    op.drop_table("billing_settlements")
