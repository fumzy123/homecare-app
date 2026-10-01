from datetime import datetime
from zoneinfo import ZoneInfo
from app.core.enums import CareArrangement, PlacementStatus
from app.core.exceptions import AppError
from app.models.weekly_care_need import WeeklyCareNeed, CareSlot
from app.repositories.client_repository import ClientRepository
from app.repositories.weekly_care_need_repository import WeeklyCareNeedRepository
from app.repositories.organization_repository import OrganizationRepository
from app.services.authorization_compliance_service import AuthorizationComplianceService
from app.services.org_service import OrgService
from app.repositories.placement_repository import PlacementRepository
from app.services.notification_service import NotificationService


class WeeklyCareNeedService:
    def __init__(self, db, current_user):
        self.db = db
        self.org_id = OrgService.get_user_org_id(current_user, db)
        self.client_repo = ClientRepository(db)
        self.care_need_repo = WeeklyCareNeedRepository(db)
        self.org_repo = OrganizationRepository(db)
        self.member = self.org_repo.get_active_employment_for_user(current_user.id)

    def get_for_client(self, client_id):
        self.client_repo.get_active_client(client_id, self.org_id)
        return self.care_need_repo.versions(client_id)

    def create_version(self, client_id, payload):
        try:
            org = self.org_repo.lock_by_id(self.org_id)
            client = self.client_repo.get_active_client(client_id, self.org_id)
            latest = self.care_need_repo.latest(client_id)
            # Compare under the organization lock, before validation or side effects:
            # retries must preserve the existing placement and its interests.
            def slots_key(slots):
                return sorted(
                    (s.day_of_week, s.start_time, s.end_time, s.service_type)
                    for s in slots
                )

            if (
                latest
                and latest.effective_from == payload.effective_from
                and slots_key(latest.care_slots) == slots_key(payload.care_slots)
            ):
                self.db.commit()
                return latest
            today = datetime.now(
                ZoneInfo(org.billing_timezone or "America/St_Johns")
            ).date()
            if payload.effective_from < today:
                raise AppError(
                    400, "PAST_EFFECTIVE_DATE", "Choose today or a future date"
                )
            if (
                latest
                and latest.activated_at
                and (latest.scheduled_from or latest.effective_from) > today
            ):
                raise AppError(
                    409,
                    "SCHEDULE_CHANGE_PENDING",
                    "The approved future version must start before another replacement is created",
                )
            if latest and payload.effective_from < latest.effective_from:
                raise AppError(
                    409,
                    "EARLIER_EFFECTIVE_DATE",
                    "New versions cannot start before the previous version",
                )
            if client.care_arrangement == CareArrangement.funded:
                result = AuthorizationComplianceService(self.db).evaluate_entries(
                    client_id, self.org_id, payload.care_slots, payload.effective_from
                )
                if any(s.status == "exceeded" for s in result.services):
                    raise AppError(
                        400,
                        "AUTHORIZATION_EXCEEDED",
                        "Weekly Care Need exceeds authorization for its effective date",
                    )
            previous = next(
                (
                    n
                    for n in self.care_need_repo.versions(client_id)
                    if n.activated_at and n.ends_on is None
                ),
                None,
            )
            need = WeeklyCareNeed(
                client_id=client_id,
                org_id=self.org_id,
                version=latest.version + 1 if latest else 1,
                effective_from=payload.effective_from,
                supersedes_id=previous.id if previous else None,
                created_by=self.member.id,
            )
            need.care_slots = [
                CareSlot(client_id=client_id, **slot.model_dump())
                for slot in payload.care_slots
            ]
            self.care_need_repo.add(need)
            if latest and not latest.activated_at:
                placements = PlacementRepository(self.db)
                prior_posting = placements.for_care_need(latest.id)
                if prior_posting and prior_posting.status == PlacementStatus.open:
                    placements.close(prior_posting)
                    notices = NotificationService(self.db, self.member.id)
                    notices.resolve_placement_interest(
                        self.org_id, prior_posting.id, []
                    )
                    notices.notify_placement_closed(
                        org_id=self.org_id,
                        placement_id=prior_posting.id,
                        masked_location=prior_posting.masked_location,
                        recipient_ids=[
                            i.employment_id for i in prior_posting.interests
                        ],
                        triggered_by_id=self.member.id,
                        commit=False,
                    )
            self.db.commit()
            return need
        except Exception:
            self.db.rollback()
            raise

    def attention_items(self):
        placements = PlacementRepository(self.db)
        clients = {
            c.id: c
            for c in self.client_repo.get_all(self.org_id)
            if c.status.value == "active"
        }
        org = self.org_repo.get_by_id(self.org_id)
        today = datetime.now(
            ZoneInfo(org.billing_timezone or "America/St_Johns")
        ).date()
        seen, items = set(), []
        for need in self.care_need_repo.list_for_org(self.org_id):
            if need.client_id in seen or need.client_id not in clients:
                continue
            seen.add(need.client_id)
            if need.imported:
                continue  # Imported coverage has no fabricated slot-to-worker provenance.
            client = clients[need.client_id]
            placement = placements.for_care_need(need.id)
            covered = (
                {a.care_slot_id for a in placements.assignments(placement.id)}
                if placement
                else set()
            )
            remaining = [s for s in need.care_slots if s.id not in covered]
            if not remaining:
                continue
            pending = (
                sum(
                    any(str(s.id) in i.care_slot_ids for s in remaining)
                    for i in placement.interests
                )
                if placement
                else 0
            )
            items.append(
                {
                    "client_id": str(client.id),
                    "client_name": f"{client.first_name} {client.last_name}",
                    "weekly_care_need_id": str(need.id),
                    "placement_id": str(placement.id) if placement else None,
                    "effective_from": need.scheduled_from or need.effective_from,
                    "overdue": not need.activated_at and need.effective_from <= today,
                    "uncovered_count": len(remaining),
                    "pending_interest_count": pending,
                    "action": "Post placement"
                    if not placement or placement.status.value == "closed"
                    else "Review interest"
                    if pending
                    else "Resolve coverage",
                }
            )
        return items
