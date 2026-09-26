"""Add nullable onboarding/trial records without enrolling legacy agencies."""
from alembic import op
import sqlalchemy as sa

revision = "c4a8b2d9e731"
down_revision = "9a7c3e1b0d24"
branch_labels = None
depends_on = None

_COLUMNS = (
    "onboarding_deadline_at", "go_live_at", "trial_starts_at", "trial_ends_at",
)


def upgrade() -> None:
    for name in _COLUMNS:
        op.add_column("organizations", sa.Column(name, sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    for name in reversed(_COLUMNS):
        op.drop_column("organizations", name)
