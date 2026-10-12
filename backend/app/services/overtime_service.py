from datetime import datetime, timezone
from app.core.enums import OVERTIME_APPROVERS, OrgMemberRole, NotificationType
from app.core.exceptions import AppError
from app.models.activity import OvertimeRequest
from app.repositories.activity_repository import ActivityRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.employment_repository import EmploymentRepository
from app.schemas.shift import (
    ShiftCreateSchema,
    RecurrenceSchema,
    ShiftUpdateSchema,
    ShiftEditFromSchema,
    ShiftModificationCreateSchema,
)
from app.repositories.shift_repository import ShiftRepository
from pydantic import ValidationError
from app.services.shift_service import ShiftService
from app.services.notification_service import NotificationService


def schedule_snapshot(shift):
    fields = (
        "worker_id",
        "client_id",
        "start_time",
        "end_time",
        "recurrence_rule",
        "recurrence_end_date",
        "notes",
        "location",
        "status",
        "deleted_at",
    )
    return {
        "master": {field: str(getattr(shift, field)) for field in fields},
        "modifications": sorted(
            [
                str(
                    (
                        m.id,
                        m.original_date,
                        m.new_start_time,
                        m.new_end_time,
                        m.completion_status,
                        m.notes,
                    )
                )
                for m in shift.modifications
            ]
        ),
    }


def change_schema(scope):
    return {
        "this": ShiftModificationCreateSchema,
        "following": ShiftEditFromSchema,
        "all": ShiftUpdateSchema,
    }[scope]


class OvertimeService:
    def __init__(self, db, current_user):
        self.db, self.current_user = db, current_user
        self.org_repo = OrganizationRepository(db)
        self.member = self.org_repo.get_active_employment_for_user(current_user.id)
        if not self.member:
            raise AppError(404, "NOT_FOUND", "Member not found")
        self.activity_repo = ActivityRepository(db)
        self.notification_repo = NotificationRepository(db)

    def request(self, payload):
        try:
            if not payload.client_id or not payload.start_time or not payload.end_time:
                raise AppError(
                    400,
                    "INCOMPLETE_SHIFT_CONTEXT",
                    "Include the client and requested visit times",
                )
            if payload.end_time <= payload.start_time:
                raise AppError(
                    400, "INVALID_SHIFT_TIMES", "End time must be after start time"
                )
            # Same lock order as scheduling: agency before request/shift.
            self.org_repo.lock_by_id(self.member.org_id)
            worker = EmploymentRepository(self.db).get_active_by_id_and_org(
                payload.worker_id, self.member.org_id
            )
            if worker.role != OrgMemberRole.home_support_worker:
                raise AppError(400, "INVALID_WORKER", "Select a home support worker")
            details = payload.model_dump(mode="json")
            if payload.shift_id:
                if not payload.edit_scope or not payload.changes:
                    raise AppError(
                        400,
                        "INCOMPLETE_SHIFT_CONTEXT",
                        "Include the requested schedule change",
                    )
                shift_repo = ShiftRepository(self.db)
                shift_repo.lock_shift(payload.shift_id, self.member.org_id)
                shift = shift_repo.get_active_shift(
                    payload.shift_id, self.member.org_id
                )
                try:
                    changes = change_schema(payload.edit_scope)(**payload.changes)
                except ValidationError as exc:
                    raise AppError(
                        400, "INVALID_SHIFT_CHANGE", "Invalid requested schedule change"
                    ) from exc
                details["changes"] = changes.model_dump(
                    mode="json", exclude_unset=True, exclude={"override_hours_check"}
                )
                details["schedule_snapshot"] = schedule_snapshot(shift)
                expected_worker = getattr(changes, "worker_id", None) or shift.worker_id
                expected_client = getattr(changes, "client_id", None) or shift.client_id
                if expected_worker != worker.id or expected_client != payload.client_id:
                    raise AppError(
                        400,
                        "INVALID_SHIFT_CHANGE",
                        "Request participants do not match the schedule change",
                    )
            elif payload.edit_scope or payload.changes:
                raise AppError(
                    400, "INCOMPLETE_SHIFT_CONTEXT", "Select the existing shift"
                )
            if payload.client_id:
                from app.repositories.client_repository import ClientRepository

                client = ClientRepository(self.db).get_active_client(
                    payload.client_id, self.member.org_id
                )
                details["client_name"] = f"{client.first_name} {client.last_name}"
            details["requesting_member_name"] = (
                f"{self.member.person.first_name} {self.member.person.last_name}"
            )
            details["requesting_member_id"] = str(self.member.id)
            # A retry of the same pending request must not produce another task.
            for existing in self.activity_repo.pending_overtime(self.member):
                if (
                    existing.requested_by == self.member.id
                    and existing.worker_id == worker.id
                    and existing.details == details
                ):
                    self.db.commit()
                    return {"ok": True}
            notice = self.notification_repo.create(
                org_id=self.member.org_id,
                type=NotificationType.overtime_approval_requested,
                payload=details,
                requires_action=True,
                about_worker_id=worker.id,
                triggered_by_id=self.member.id,
            )
            self.notification_repo.create_reads_for_approvers(
                notice.id, self.member.org_id
            )
            self.activity_repo.add_overtime(
                OvertimeRequest(
                    org_id=self.member.org_id,
                    notification_id=notice.id,
                    worker_id=worker.id,
                    requested_by=self.member.id,
                    details=details,
                    status="pending",
                )
            )
            self.db.commit()
            return {"ok": True}
        except Exception:
            self.db.rollback()
            raise

    def _request(self, ident, lock=False):
        request = self.activity_repo.overtime(self.member.org_id, ident, lock)
        if not request or (
            self.member.role not in OVERTIME_APPROVERS
            and request.requested_by != self.member.id
        ):
            raise AppError(404, "NOT_FOUND", "Request not found")
        return request

    def detail(self, ident):
        request = self._request(ident)
        notice = self.notification_repo.get_by_id(ident)
        result = NotificationService._to_response(notice, None).model_dump()
        result["payload"] = request.details
        result["resolved_at"] = request.decided_at
        result["can_decide"] = self.member.role in OVERTIME_APPROVERS
        result["request_status"] = request.status
        result["decision_note"] = request.decision_note
        return result

    def _pending(self, ident):
        if self.member.role not in OVERTIME_APPROVERS:
            raise AppError(
                403,
                "FORBIDDEN",
                "Only owners and managers can decide overtime requests",
            )
        self.org_repo.lock_by_id(self.member.org_id)
        request = self._request(ident, lock=True)
        if request.status != "pending":
            raise AppError(
                409,
                "REQUEST_DECIDED",
                "This request has already been decided. Refresh to see the outcome",
            )
        return request

    def _decide(self, request, status, note=None):
        request.status, request.decided_by, request.decided_at = (
            status,
            self.member.id,
            datetime.now(timezone.utc),
        )
        request.decision_note = note
        notice = self.notification_repo.get_by_id(request.notification_id)
        self.notification_repo.mark_resolved(notice, self.member.id)
        self.activity_repo.record(
            self.member.org_id,
            self.member.id,
            f"notice:{notice.id}",
            "schedule",
            f"Overtime {status}",
            request.details.get("client_name") or "Requested visit",
            {"kind": "overtime", "record_id": str(notice.id)},
        )

    async def approve(self, payload):
        try:
            request = self._pending(payload.notification_id)
            p = request.details
            if not all(p.get(k) for k in ("client_id", "start_time", "end_time")):
                raise AppError(
                    409,
                    "INCOMPLETE_SHIFT_CONTEXT",
                    "This older request lacks visit details. Reject it and request approval with the complete visit",
                )
            if p.get("shift_id"):
                shift_repo = ShiftRepository(self.db)
                shift_repo.lock_shift(p["shift_id"], self.member.org_id)
                shift = shift_repo.get_active_shift(p["shift_id"], self.member.org_id)
                self.db.refresh(shift)
                self.db.expire(shift, ["modifications"])
                if schedule_snapshot(shift) != p.get("schedule_snapshot"):
                    raise AppError(
                        409,
                        "SCHEDULE_CHANGED",
                        "The schedule changed since this request. Reject it and submit an updated request",
                    )
                if any(
                    getattr(payload, k) is not None
                    for k in ("start_time", "end_time", "is_recurring", "recurrence")
                ):
                    raise AppError(
                        400,
                        "INVALID_SHIFT_CHANGE",
                        "Approve the submitted change or reject it for revision",
                    )
                service = ShiftService(self.db, self.current_user)
                changes = change_schema(p["edit_scope"])(
                    **{**p["changes"], "override_hours_check": True}
                )
                if p["edit_scope"] == "this":
                    await service.create_modification(shift.id, changes, commit=False)
                elif p["edit_scope"] == "following":
                    await service.edit_from_date(shift.id, changes, commit=False)
                else:
                    await service.update_shift(shift.id, changes, commit=False)
                request.shift_id = shift.id
                self._decide(request, "approved")
                self.db.commit()
                self.db.refresh(shift)
                return shift
            recurrence = (
                payload.recurrence
                if payload.is_recurring is not None
                else (
                    RecurrenceSchema(**p["recurrence"])
                    if p.get("is_recurring") and p.get("recurrence")
                    else None
                )
            )
            if payload.is_recurring is False:
                recurrence = None
            shift = await ShiftService(self.db, self.current_user).create_shift(
                ShiftCreateSchema(
                    worker_id=request.worker_id,
                    client_id=p["client_id"],
                    start_time=payload.start_time
                    or datetime.fromisoformat(p["start_time"]),
                    end_time=payload.end_time or datetime.fromisoformat(p["end_time"]),
                    recurrence=recurrence,
                    service_type=p.get("service_type"),
                    location=p.get("location"),
                    notes=p.get("notes"),
                    override_hours_check=True,
                ),
                commit=False,
            )
            request.shift_id = shift.id
            self._decide(request, "approved")
            self.db.commit()
            self.db.refresh(shift)
            return shift
        except Exception:
            self.db.rollback()
            raise

    def reject(self, payload):
        try:
            request = self._pending(payload.notification_id)
            self._decide(request, "rejected", payload.reason)
            self.db.commit()
            return {"ok": True}
        except Exception:
            self.db.rollback()
            raise
