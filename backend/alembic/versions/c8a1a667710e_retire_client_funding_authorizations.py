"""retire client funding authorizations

Revision ID: c8a1a667710e
Revises: 2e11cbcf7fed
Create Date: 2026-10-21 11:02:42.335331

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c8a1a667710e'
down_revision: Union[str, Sequence[str], None] = '2e11cbcf7fed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Delete the retired pre-launch funding data; leave all care history intact."""
    # Activity reads cascade with the retired events. Other activity is retained.
    op.execute("DELETE FROM activity_events WHERE category = 'authorizations'")
    op.drop_table('authorization_services')
    op.drop_table('authorizations')
    op.drop_column('clients', 'care_arrangement')
    op.drop_column('organizations', 'uses_authorizations')
    op.execute('DROP TYPE carearrangement')
    op.execute('DROP TYPE hoursperiod')
    # Deliberately no UPDATE of shifts, assignments, care slots or care revisions:
    # existing recurrence_end_date values remain exactly as recorded.


def downgrade() -> None:
    raise RuntimeError(
        'Funding retirement deletes pre-launch records and cannot restore them. '
        'Restore a pre-migration backup to run the previous application.'
    )
