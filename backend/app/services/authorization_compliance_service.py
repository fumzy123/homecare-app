from collections import defaultdict
from datetime import date, time
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.enums import HoursPeriod, ServiceType, ClientStatus, AuthorizationCoverage
from app.models.client import Client
from app.repositories.authorization_repository import AuthorizationRepository
from app.repositories.care_schedule_repository import CareScheduleRepository
from app.schemas.authorization import ServiceCompliance, AuthorizationComplianceResponse

# A planned service is "approaching" its cap at this fraction of authorized hours.
APPROACHING_THRESHOLD = 0.9


class AuthorizationComplianceService:
    """Single source of truth for the rule: planned/delivered care must never
    exceed what the funder authorized, per service type, measured over the
    bi-weekly payment window. Read-only — owns no transaction."""

    def __init__(self, db: Session):
        self.db = db
        self.auth_repo = AuthorizationRepository(db)
        self.schedule_repo = CareScheduleRepository(db)

    # ── Public API ────────────────────────────────────────────────────────────

    def check(self, client_id: UUID, org_id: UUID, on_date: date | None = None) -> AuthorizationComplianceResponse:
        """Compliance of the client's *persisted* care schedule."""
        blocks = self.schedule_repo.list_for_client(client_id)
        return self._evaluate(client_id, org_id, blocks, on_date)

    def evaluate_blocks(
        self, client_id: UUID, org_id: UUID, blocks, on_date: date | None = None
    ) -> AuthorizationComplianceResponse:
        """Compliance of a *proposed* set of blocks (ORM rows or input schemas —
        anything with service_type / start_time / end_time). Used to hard-block
        an over-plan before it is saved."""
        return self._evaluate(client_id, org_id, blocks, on_date)

    # ── Internals ─────────────────────────────────────────────────────────────

    def _evaluate(self, client_id, org_id, blocks, on_date) -> AuthorizationComplianceResponse:
        today = on_date or date.today()
        active = self.auth_repo.list_active_for_client(client_id, org_id, today)

        # Authorized hours per service, normalized to the bi-weekly window.
        authorized: dict[ServiceType, float] = defaultdict(float)
        for auth in active:
            for svc in auth.services:
                authorized[svc.service_type] += self._to_biweekly(float(svc.authorized_hours), auth.hours_period)

        # Planned hours per service — the schedule is a weekly pattern, so ×2.
        planned_weekly: dict[ServiceType, float] = defaultdict(float)
        for b in blocks:
            planned_weekly[b.service_type] += self._block_hours(b.start_time, b.end_time)

        services: list[ServiceCompliance] = []
        for st in sorted(set(authorized) | set(planned_weekly), key=lambda s: s.value):
            auth_bw = round(authorized.get(st, 0.0), 2)
            plan_bw = round(planned_weekly.get(st, 0.0) * 2, 2)
            services.append(ServiceCompliance(
                service_type=st,
                authorized_biweekly=auth_bw,
                planned_biweekly=plan_bw,
                remaining=round(auth_bw - plan_bw, 2),
                status=self._status(auth_bw, plan_bw),
            ))

        return AuthorizationComplianceResponse(
            client_id=client_id,
            coverage=self._coverage(client_id, active),
            services=services,
        )

    def _coverage(self, client_id: UUID, active_auths: list) -> AuthorizationCoverage:
        client = self.db.query(Client).filter(Client.id == client_id).first()
        is_active = client is not None and client.status == ClientStatus.active
        if is_active and not active_auths:
            return AuthorizationCoverage.lapsed
        return AuthorizationCoverage.covered

    @staticmethod
    def _to_biweekly(hours: float, period: HoursPeriod) -> float:
        if period == HoursPeriod.per_week:
            return hours * 2
        if period == HoursPeriod.per_month:
            return hours * 12 / 26
        return hours  # bi_weekly

    @staticmethod
    def _block_hours(start: time, end: time) -> float:
        start_s = start.hour * 3600 + start.minute * 60 + start.second
        end_s = end.hour * 3600 + end.minute * 60 + end.second
        return max(0.0, (end_s - start_s) / 3600.0)

    @staticmethod
    def _status(authorized: float, planned: float) -> str:
        if planned > authorized + 1e-9:
            return "exceeded"
        if authorized > 0 and planned >= APPROACHING_THRESHOLD * authorized:
            return "approaching"
        return "within"
