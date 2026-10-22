"""record care slot assignment source

Revision ID: 2e11cbcf7fed
Revises: c4e9812ab760
Create Date: 2026-10-16 15:17:25.907210

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2e11cbcf7fed"
down_revision: Union[str, Sequence[str], None] = "c4e9812ab760"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Earlier slot approvals required worker interest. Retain that provenance;
    # new office-arranged approvals retain the existing approver and timestamp.
    op.add_column(
        "care_slot_assignments",
        sa.Column(
            "assignment_source",
            sa.String(),
            nullable=False,
            server_default="worker_interest",
        ),
    )
    op.create_check_constraint(
        "ck_assignment_source",
        "care_slot_assignments",
        "assignment_source IN ('worker_interest', 'admin_arranged')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    raise RuntimeError(
        "Assignment provenance must be retained; roll back application code without dropping this column."
    )
