from sqlalchemy.orm import joinedload, selectinload
from app.models.placement import CareSlotAssignment, Placement
from app.models.employment import Employment
from app.models.shift import Shift
from app.models.progress_note import ProgressNote


class AssignmentRepository:
    def __init__(self, db):
        self.db = db

    def _query(self, org_id):
        return self.db.query(CareSlotAssignment).join(Placement).filter(Placement.org_id == org_id)

    @staticmethod
    def _details(query):
        return query.options(
            joinedload(CareSlotAssignment.employment).joinedload(Employment.person),
            joinedload(CareSlotAssignment.care_slot),
            joinedload(CareSlotAssignment.placement).joinedload(Placement.client),
            joinedload(CareSlotAssignment.placement).joinedload(Placement.weekly_care_need))

    def list(self, org_id, worker_id=None, client_id=None):
        query = self._query(org_id)
        if worker_id:
            query = query.filter(CareSlotAssignment.employment_id == worker_id)
        if client_id:
            query = query.filter(Placement.client_id == client_id)
        return self._details(query).order_by(CareSlotAssignment.starts_on.desc(), CareSlotAssignment.id).all()

    def lock_selected(self, org_id, assignment_ids):
        query = self._query(org_id).filter(CareSlotAssignment.id.in_(assignment_ids))
        # Lock only assignment rows, then eager-load nullable relations separately.
        rows = query.order_by(CareSlotAssignment.id).populate_existing().with_for_update(of=CareSlotAssignment).all()
        return rows

    def lock_shifts(self, org_id, assignment_ids):
        return self.db.query(Shift).filter(Shift.org_id == org_id,
            Shift.assignment_id.in_(assignment_ids), Shift.deleted_at.is_(None)
        ).order_by(Shift.id).populate_existing().with_for_update().options(selectinload(Shift.modifications)).all()

    def notes(self, org_id, shift_ids):
        return self.db.query(ProgressNote).join(Shift).filter(
            Shift.org_id == org_id, ProgressNote.shift_id.in_(shift_ids)).all() if shift_ids else []
