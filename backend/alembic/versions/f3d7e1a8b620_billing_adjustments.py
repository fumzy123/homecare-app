"""Auditable proposals and decisions for finalized usage corrections."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "f3d7e1a8b620"
down_revision = "e2c6d0f7a519"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("billing_adjustments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("period_id", UUID(as_uuid=True), sa.ForeignKey("billing_usage_snapshots.period_id"), nullable=False),
        sa.Column("request_id", UUID(as_uuid=True), nullable=False),
        sa.Column("baseline_sequence", sa.Integer(), nullable=False),
        sa.Column("approval_sequence", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("proposed_by", UUID(as_uuid=True), nullable=False),
        sa.Column("proposed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_by", UUID(as_uuid=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_reason", sa.String(), nullable=True),
        sa.Column("settlement_status", sa.String(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.UniqueConstraint("org_id", "period_id", "request_id", name="uq_billing_adjustment_request"),
        sa.UniqueConstraint("period_id", "approval_sequence", name="uq_billing_adjustment_approval"),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_billing_adjustment_status"),
        sa.CheckConstraint("baseline_sequence >= 0", name="ck_billing_adjustment_baseline"),
        sa.CheckConstraint("(status = 'approved' AND approval_sequence IS NOT NULL AND approval_sequence = baseline_sequence + 1) OR "
                           "(status != 'approved' AND approval_sequence IS NULL)", name="ck_billing_adjustment_sequence"),
    )
    op.create_index("ix_billing_adjustment_org_period", "billing_adjustments", ["org_id", "period_id", "proposed_at"])
    op.create_table("billing_adjustment_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("adjustment_id", UUID(as_uuid=True), sa.ForeignKey("billing_adjustments.id"), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("actor_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("adjustment_id", "action", name="uq_billing_adjustment_event"),
    )
    op.execute("ALTER TABLE billing_adjustments ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE billing_adjustment_events ENABLE ROW LEVEL SECURITY")


def downgrade():
    op.drop_table("billing_adjustment_events")
    op.drop_table("billing_adjustments")
