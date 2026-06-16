from uuid import UUID
from sqlalchemy.orm import Session
from supabase_auth.types import User as SupabaseUser
from app.core.exceptions import AppError
from app.core.enums import CareArrangement
from app.models.client import Client
from app.models.care_schedule import CareScheduleBlock
from app.repositories.care_schedule_repository import CareScheduleRepository
from app.services.authorization_compliance_service import AuthorizationComplianceService
from app.services.org_service import OrgService
from app.schemas.care_schedule import CareSchedulePutSchema, CareScheduleBlockResponse


class CareScheduleService:
    """The client's planned weekly care. Saving a schedule that exceeds the
    client's active authorizations is hard-blocked (the plan is our own intent —
    keep it within what was authorized)."""

    def __init__(self, db: Session, current_user: SupabaseUser):
        self.db = db
        self.current_user = current_user
        self.repo = CareScheduleRepository(db)
        self.compliance = AuthorizationComplianceService(db)
        self.org_id = OrgService.get_user_org_id(current_user, db)

    def get_for_client(self, client_id: UUID) -> list[CareScheduleBlockResponse]:
        self._get_client(client_id)
        return [
            CareScheduleBlockResponse.model_validate(b)
            for b in self.repo.list_for_client(client_id)
        ]

    def replace_for_client(
        self, client_id: UUID, payload: CareSchedulePutSchema
    ) -> list[CareScheduleBlockResponse]:
        client = self._get_client(client_id)

        # Compliance is a funded-client rule only. Self-pay clients schedule
        # freely — there is no funder cap to comply with.
        if client.care_arrangement == CareArrangement.funded:
            compliance = self.compliance.evaluate_blocks(client_id, self.org_id, payload.blocks)
            exceeded = [s for s in compliance.services if s.status == "exceeded"]
            if exceeded:
                detail = "; ".join(
                    f"{s.service_type.value}: {s.planned_biweekly}h planned vs {s.authorized_biweekly}h authorized"
                    for s in exceeded
                )
                raise AppError(
                    status_code=400,
                    code="AUTHORIZATION_EXCEEDED",
                    message=f"Care schedule exceeds authorized hours — {detail}",
                )

        try:
            blocks = [
                CareScheduleBlock(
                    client_id=client_id,
                    day_of_week=b.day_of_week,
                    start_time=b.start_time,
                    end_time=b.end_time,
                    service_type=b.service_type,
                )
                for b in payload.blocks
            ]
            self.repo.replace_for_client(client_id, blocks)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        return [CareScheduleBlockResponse.model_validate(b) for b in self.repo.list_for_client(client_id)]

    def _get_client(self, client_id: UUID) -> Client:
        client = (
            self.db.query(Client)
            .filter(Client.id == client_id, Client.org_id == self.org_id)
            .first()
        )
        if not client:
            raise AppError(status_code=404, code="NOT_FOUND", message="Client not found")
        return client
