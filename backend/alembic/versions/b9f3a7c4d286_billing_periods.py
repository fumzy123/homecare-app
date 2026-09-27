"""Explicit agency timezone and immutable monthly usage period terms."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "b9f3a7c4d286"
down_revision = "a8e2f6b3c175"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("organizations", sa.Column("billing_timezone", sa.String(), nullable=True))
    op.create_table(
        "billing_periods",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("subscription_id", sa.String(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("anchor_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("agency_timezone", sa.String(), nullable=False),
        sa.Column("plan_code", sa.String(), nullable=False),
        sa.Column("plan_version", sa.Integer(), nullable=False),
        sa.Column("base_interval", sa.String(), nullable=False),
        sa.Column("included_clients", sa.Integer(), nullable=False),
        sa.Column("additional_client_amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("finalization_eligible_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "subscription_id", "starts_at", name="uq_billing_period_org_subscription_start"),
        sa.CheckConstraint("ends_at > starts_at", name="ck_billing_period_order"),
        sa.CheckConstraint("included_clients >= 0 AND additional_client_amount_cents >= 0", name="ck_billing_period_rates"),
    )


def downgrade():
    op.drop_table("billing_periods")
    op.drop_column("organizations", "billing_timezone")
