from datetime import date

from app.core.enums import EmploymentStatus, OrgMemberRole
from app.core.exceptions import AppError
from app.domain.scheduling import expand_occurrences, resolve_effective_occurrence
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.shift_repository import ShiftRepository
from app.repositories.worker_client_repository import WorkerClientRepository
from app.schemas.shift import ClientSummary, WorkerShiftDetailResponse


class WorkerClientService:
    def __init__(self, db, current_user):
        self.db = db
        self.client_repo = WorkerClientRepository(db)
        self.shift_repo = ShiftRepository(db)
        self.org_repo = OrganizationRepository(db)
        employment = self.org_repo.get_active_employment_for_user(current_user.id)
        if (not employment or employment.employment_status != EmploymentStatus.active
                or employment.role != OrgMemberRole.home_support_worker):
            raise AppError(403, "WORKER_ACCESS_REQUIRED", "Active worker access is required")
        self.org_id, self.worker_id = employment.org_id, employment.id
        org = self.org_repo.get_by_id(self.org_id)
        if not org or not org.is_active or org.deleted_at is not None:
            raise AppError(403, "WORKER_ACCESS_REQUIRED", "Active agency access is required")

    def list_clients(self):
        return self.client_repo.list_for_worker(self.org_id, self.worker_id)

    def get_client(self, client_id):
        return self.client_repo.get_for_worker(client_id, self.org_id, self.worker_id)

    def get_client_shifts(self, client_id, from_date: date, to_date: date):
        client = self.get_client(client_id)
        if to_date < from_date or (to_date - from_date).days > 30:
            raise AppError(400, "INVALID_DATE_RANGE", "Choose a date range of at most 31 days")
        shifts = self.shift_repo.get_shifts_in_range(
            self.org_id, to_date, worker_id=self.worker_id, client_id=client_id,
        )
        results = []
        for shift in shifts:
            modifications = {m.original_date: m for m in shift.modifications}
            for day in expand_occurrences(shift, from_date, to_date):
                occurrence = resolve_effective_occurrence(shift, day, modifications.get(day))
                results.append(WorkerShiftDetailResponse(
                    shift_id=occurrence.shift_id, occurrence_date=occurrence.occurrence_date,
                    modification_id=occurrence.modification_id,
                    start_time=occurrence.start_time, end_time=occurrence.end_time,
                    completion_status=occurrence.completion_status,
                    service_type=occurrence.service_type, client=ClientSummary.model_validate(client),
                    location=occurrence.location, instructions=occurrence.instructions,
                    is_modified=occurrence.is_modified,
                ))
        return sorted(results, key=lambda item: (item.start_time, str(item.shift_id)), reverse=True)
