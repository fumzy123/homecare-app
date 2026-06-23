from uuid import UUID
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.core.exceptions import AppError
from app.core.enums import CareArrangement
from app.models.client import Client
from app.models.weekly_care_plan import WeeklyCarePlanEntry
from app.repositories.weekly_care_plan_repository import WeeklyCarePlanRepository
from app.services.authorization_compliance_service import AuthorizationComplianceService
from app.services.org_service import OrgService
from app.schemas.weekly_care_plan import WeeklyCarePlanPutSchema, WeeklyCarePlanEntryResponse


class WeeklyCarePlanService:
    """The client's weekly care plan — the recurring blocks of care we intend to
    deliver. For a funded client, saving a plan that exceeds the client's active
    authorizations is hard-blocked (the plan is our own intent — keep it within
    what the funder authorized). Self-pay clients plan freely."""

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.repo = WeeklyCarePlanRepository(db)
        self.compliance = AuthorizationComplianceService(db)
        self.org_id = OrgService.get_user_org_id(current_user, db)

    def get_for_client(self, client_id: UUID) -> list[WeeklyCarePlanEntryResponse]:
        self._get_client(client_id)
        return [
            WeeklyCarePlanEntryResponse.model_validate(e)
            for e in self.repo.list_for_client(client_id)
        ]

    def replace_for_client(
        self, client_id: UUID, payload: WeeklyCarePlanPutSchema
    ) -> list[WeeklyCarePlanEntryResponse]:
        client = self._get_client(client_id)

        # Compliance is a funded-client rule only. Self-pay clients plan freely —
        # there is no funder cap to comply with.
        if client.care_arrangement == CareArrangement.funded:
            compliance = self.compliance.evaluate_entries(client_id, self.org_id, payload.entries)
            exceeded = [s for s in compliance.services if s.status == "exceeded"]
            if exceeded:
                detail = "; ".join(
                    f"{s.service_type.value}: {s.planned_biweekly}h planned vs {s.authorized_biweekly}h authorized"
                    for s in exceeded
                )
                raise AppError(
                    status_code=400,
                    code="AUTHORIZATION_EXCEEDED",
                    message=f"Weekly care plan exceeds authorized hours — {detail}",
                )

        try:
            entries = [
                WeeklyCarePlanEntry(
                    client_id=client_id,
                    day_of_week=e.day_of_week,
                    start_time=e.start_time,
                    end_time=e.end_time,
                    service_type=e.service_type,
                )
                for e in payload.entries
            ]
            self.repo.replace_for_client(client_id, entries)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        return [WeeklyCarePlanEntryResponse.model_validate(e) for e in self.repo.list_for_client(client_id)]

    def _get_client(self, client_id: UUID) -> Client:
        client = (
            self.db.query(Client)
            .filter(Client.id == client_id, Client.org_id == self.org_id)
            .first()
        )
        if not client:
            raise AppError(status_code=404, code="NOT_FOUND", message="Client not found")
        return client
