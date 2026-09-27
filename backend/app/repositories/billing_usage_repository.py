from datetime import datetime, time, timedelta
from sqlalchemy import and_, or_

from app.core.enums import ShiftStatus
from app.domain.billing_usage import HISTORICAL_STATUSES, UsageCandidate, UsageWindow
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification


class BillingUsageRepository:
    def __init__(self, db):
        self.db = db

    def candidates(self, org_id, window: UsageWindow) -> list[UsageCandidate]:
        first, last = window.local_dates
        lower = datetime.combine(first, time.min)
        upper = datetime.combine(last + timedelta(days=1), time.min)
        moved_in = and_(ShiftModification.new_start_time >= lower, ShiftModification.new_start_time < upper)
        relevant_mod = or_(ShiftModification.original_date.between(first, last), moved_in)
        live_master = and_(Shift.status == ShiftStatus.active, Shift.deleted_at.is_(None))
        normal_range = or_(
            and_(Shift.is_recurring.is_(False), Shift.start_time >= lower, Shift.start_time < upper),
            and_(Shift.is_recurring.is_(True), Shift.start_time < upper,
                 or_(Shift.recurrence_end_date.is_(None), Shift.recurrence_end_date >= first)),
        )
        # Correlated EXISTS uses the modification's existing (shift_id,
        # original_date) unique index; no worker/client joins or registry filters.
        eligible = or_(
            and_(live_master, or_(normal_range, Shift.modifications.any(moved_in))),
            Shift.modifications.any(and_(relevant_mod, ShiftModification.completion_status.in_(HISTORICAL_STATUSES))),
        )
        rows = self.db.query(Shift, ShiftModification).outerjoin(
            ShiftModification, and_(ShiftModification.shift_id == Shift.id, relevant_mod),
        ).filter(Shift.org_id == org_id, eligible).order_by(
            Shift.client_id, Shift.id, ShiftModification.original_date,
        ).all()
        # One statement provides a consistent read. Do not assign a filtered
        # collection to an ORM relationship or trigger lazy loads per shift.
        grouped = {}
        for shift, modification in rows:
            if shift.id not in grouped:
                grouped[shift.id] = (shift, [])
            if modification is not None:
                grouped[shift.id][1].append(modification)
        return [UsageCandidate(shift, tuple(mods)) for shift, mods in grouped.values()]
