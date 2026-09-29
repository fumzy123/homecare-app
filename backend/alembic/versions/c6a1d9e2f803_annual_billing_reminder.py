"""Annual usage collection reminder notification."""
from alembic import op

revision = "c6a1d9e2f803"
down_revision = "b5f9a3c0d842"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'billing_annual_reminder'")


def downgrade():
    # PostgreSQL cannot remove a single enum value safely; retain historical notices.
    pass
