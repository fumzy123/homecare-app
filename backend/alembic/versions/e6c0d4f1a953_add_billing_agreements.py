"""Persist owner billing consent and Stripe retry boundaries."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "e6c0d4f1a953"
down_revision = "d5b9c3e0f842"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "billing_agreements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False, unique=True),
        sa.Column("plan_code", sa.String(), nullable=False),
        sa.Column("plan_version", sa.Integer(), nullable=False),
        sa.Column("base_interval", sa.String(), nullable=False),
        sa.Column("stripe_price_id", sa.String(), nullable=False),
        sa.Column("consent_version", sa.String(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_by", UUID(as_uuid=True), nullable=False),
        sa.Column("customer_attempted_at", sa.DateTime(timezone=True)),
        sa.Column("checkout_session_id", sa.String()),
        sa.Column("payment_method_id", sa.String()),
        sa.Column("canceled_at", sa.DateTime(timezone=True)),
    )
    op.add_column("trial_activations", sa.Column("stripe_attempted_at", sa.DateTime(timezone=True)))


def downgrade():
    op.drop_column("trial_activations", "stripe_attempted_at")
    op.drop_table("billing_agreements")
