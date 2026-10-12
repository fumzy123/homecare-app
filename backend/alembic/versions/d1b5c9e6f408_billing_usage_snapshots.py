"""Fixed monthly usage snapshots after the correction window."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "d1b5c9e6f408"
down_revision = "c0a4b8d5e397"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "billing_usage_snapshots",
        sa.Column("period_id", UUID(as_uuid=True), sa.ForeignKey("billing_periods.id"), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("active_client_count", sa.Integer(), nullable=False),
        sa.Column("additional_clients", sa.Integer(), nullable=False),
        sa.Column("usage_amount_cents", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.CheckConstraint("active_client_count >= 0 AND additional_clients >= 0 AND usage_amount_cents >= 0",
                           name="ck_usage_snapshot_nonnegative"),
    )
    op.create_index("ix_usage_snapshot_org_finalized", "billing_usage_snapshots", ["org_id", "finalized_at"])
    op.create_index("ix_billing_period_finalization_due", "billing_periods", ["finalization_eligible_at", "id"])


def downgrade():
    op.drop_index("ix_billing_period_finalization_due", table_name="billing_periods")
    op.drop_table("billing_usage_snapshots")
