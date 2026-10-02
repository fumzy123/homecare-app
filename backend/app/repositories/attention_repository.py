"""Bounded, tenant-scoped reads for the shared admin attention feed."""
from datetime import timedelta
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import joinedload, selectinload
from app.core.enums import ClientStatus, OrgMemberRole, EmploymentStatus, ShiftStatus, ShiftCompletionStatus
from app.models.client import Client
from app.models.credential import Credential
from app.models.employment import Employment
from app.models.person import Person
from app.models.weekly_care_need import WeeklyCareNeed
from app.models.placement import Placement, CareSlotAssignment, PlacementInterest
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.repositories.authorization_repository import AuthorizationRepository


class AttentionRepository:
    def __init__(self, db):
        self.db = db

    def clients(self, org_id):
        return self.db.query(Client.id, Client.first_name, Client.last_name).filter(
            Client.org_id == org_id, Client.deleted_at.is_(None), Client.status == ClientStatus.active,
        ).all()

    def care_needs(self, org_id, today):
        latest = self.db.query(WeeklyCareNeed.client_id, func.max(WeeklyCareNeed.version).label('version')).filter(
            WeeklyCareNeed.org_id == org_id,
        ).group_by(WeeklyCareNeed.client_id).subquery()
        return self.db.query(WeeklyCareNeed).join(latest, latest.c.client_id == WeeklyCareNeed.client_id).filter(WeeklyCareNeed.org_id == org_id, or_(
            latest.c.version == WeeklyCareNeed.version,
            and_(WeeklyCareNeed.activated_at.isnot(None), or_(WeeklyCareNeed.ends_on.is_(None), WeeklyCareNeed.ends_on >= today)),
        )).options(selectinload(WeeklyCareNeed.care_slots)).all()

    def placements(self, org_id, need_ids):
        return self.db.query(Placement).filter(
            Placement.org_id == org_id, Placement.weekly_care_need_id.in_(need_ids),
        ).options(selectinload(Placement.interests).joinedload(PlacementInterest.employment).joinedload(Employment.person)).all() if need_ids else []

    def assignments(self, org_id, placement_ids):
        return self.db.query(CareSlotAssignment.placement_id, CareSlotAssignment.care_slot_id).join(
            Placement, Placement.id == CareSlotAssignment.placement_id,
        ).filter(Placement.org_id == org_id, Placement.id.in_(placement_ids)).all() if placement_ids else []

    def credentials(self, org_id, today):
        return self.db.query(Credential, Employment.id, Person.first_name, Person.last_name).join(
            Person, Person.id == Credential.person_id,
        ).join(Employment, Employment.person_id == Person.id).filter(
            Employment.org_id == org_id, Employment.deleted_at.is_(None),
            Employment.role == OrgMemberRole.home_support_worker,
            Employment.employment_status == EmploymentStatus.active,
            or_(Credential.expiry_date <= today + timedelta(days=30),
                and_(Credential.file_url.isnot(None), Credential.verified_at.is_(None))),
        ).all()

    def authorizations(self, org_id):
        return AuthorizationRepository(self.db).list_for_org_with_client(org_id)

    def shifts(self, org_id, from_date, to_date):
        # Include recurring series and all explicit modifications. Expansion and
        # effective times remain governed by the shared scheduling domain.
        return self.db.query(Shift).join(Client, Client.id == Shift.client_id).filter(
            Shift.org_id == org_id, Client.org_id == org_id, Client.deleted_at.is_(None),
            Client.status == ClientStatus.active, Shift.deleted_at.is_(None), Shift.status == ShiftStatus.active,
            or_(and_(func.date(Shift.start_time) <= to_date, or_(
                and_(Shift.is_recurring.is_(False), func.date(Shift.start_time) >= from_date),
                and_(Shift.is_recurring.is_(True), or_(Shift.recurrence_end_date.is_(None), Shift.recurrence_end_date >= from_date)),
            )), Shift.modifications.any(ShiftModification.completion_status == ShiftCompletionStatus.dropped), Shift.modifications.any(and_(func.date(ShiftModification.new_start_time) >= from_date, func.date(ShiftModification.new_start_time) <= to_date))),
        ).options(joinedload(Shift.client), selectinload(Shift.modifications)).all()
