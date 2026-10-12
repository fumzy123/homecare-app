from datetime import datetime, time, timedelta
from sqlalchemy import and_, exists, or_
from sqlalchemy.orm import aliased
from app.models.billing_visit_evidence import BillingVisitEvidence


class BillingEvidenceRepository:
    def __init__(self, db):
        self.db = db

    def _latest(self, org_id):
        row = BillingVisitEvidence
        newer = aliased(row)
        return self.db.query(row).populate_existing().filter(row.org_id == org_id, ~exists().where(and_(
            newer.org_id == row.org_id, newer.shift_id == row.shift_id,
            newer.occurrence_date == row.occurrence_date, newer.revision > row.revision,
        )))

    def for_shift(self, org_id, shift_id):
        return self._latest(org_id).filter(BillingVisitEvidence.shift_id == shift_id).all()

    def for_window(self, org_id, window, candidate_shift_ids):
        first, last = window.local_dates
        row = BillingVisitEvidence
        # Include moved-out/cancelled versions to suppress stale mutable evidence.
        return self._latest(org_id).filter(or_(
            and_(row.local_start >= datetime.combine(first, time.min),
                 row.local_start < datetime.combine(last + timedelta(days=1), time.min)),
            row.shift_id.in_(candidate_shift_ids),
        )).all()

    def add(self, row):
        self.db.add(row)
