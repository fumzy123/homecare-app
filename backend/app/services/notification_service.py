from uuid import UUID
from sqlalchemy.orm import Session
from app.models.employment import Employment
from app.core.enums import NotificationType, TargetAudience
from app.core.exceptions import AppError
from app.repositories.notification_repository import NotificationRepository
from app.schemas.notification import NotificationResponse, NotificationListResponse


class NotificationService:
    def __init__(self, db: Session, current_user_id: UUID | None = None):
        self.db = db
        self.current_user_id = current_user_id
        self.repo = NotificationRepository(db)

    # ── Called from BackgroundTasks / other services (no current_user needed) ─

    def notify_credential_uploaded(
        self, org_id: UUID, worker_id: UUID, document_type: str
    ) -> None:
        notification = self.repo.create(
            org_id=org_id,
            type=NotificationType.credential_uploaded,
            payload={"document_type": document_type},
            requires_action=True,
            target_audience=TargetAudience.admins_only,
            about_worker_id=worker_id,
            triggered_by_id=worker_id,
        )
        self.repo.create_reads_for_admins(notification.id, org_id)
        self.db.commit()

    def notify_profile_updated(
        self, org_id: UUID, worker_id: UUID, changed_fields: list[str]
    ) -> None:
        if not changed_fields:
            return
        notification = self.repo.create(
            org_id=org_id,
            type=NotificationType.profile_updated,
            payload={"changed_fields": changed_fields},
            requires_action=False,
            target_audience=TargetAudience.admins_only,
            about_worker_id=worker_id,
            triggered_by_id=worker_id,
        )
        self.repo.create_reads_for_admins(notification.id, org_id)
        self.db.commit()

    def notify_overtime_approval_requested(
        self,
        org_id: UUID,
        requesting_member_id: UUID,
        requesting_member_name: str,
        worker_id: UUID,
        week_start: str,
        week_end: str,
        total_hours: float,
        client_id: UUID | None = None,
        client_name: str | None = None,
        start_time: str | None = None,
        end_time: str | None = None,
        is_recurring: bool = False,
        recurrence: dict | None = None,
        note: str | None = None,
    ) -> None:
        notification = self.repo.create(
            org_id=org_id,
            type=NotificationType.overtime_approval_requested,
            payload={
                "requesting_member_id": str(requesting_member_id),
                "requesting_member_name": requesting_member_name,
                "week_start": week_start,
                "week_end": week_end,
                "total_hours": total_hours,
                "client_id": str(client_id) if client_id else None,
                "client_name": client_name,
                "start_time": start_time,
                "end_time": end_time,
                "is_recurring": is_recurring,
                "recurrence": recurrence,
                "note": note,
            },
            requires_action=True,
            target_audience=TargetAudience.admins_only,
            about_worker_id=worker_id,
            triggered_by_id=requesting_member_id,
        )
        self.repo.create_reads_for_approvers(notification.id, org_id)
        self.db.commit()

    def notify_shift_dropped(
        self, org_id: UUID, worker_id: UUID, shift_id: UUID,
        occurrence_date: str, client_name: str
    ) -> None:
        notification = self.repo.create(
            org_id=org_id,
            type=NotificationType.shift_dropped,
            payload={
                "shift_id": str(shift_id),
                "occurrence_date": occurrence_date,
                "client_name": client_name,
            },
            requires_action=True,
            target_audience=TargetAudience.admins_only,
            about_worker_id=worker_id,
            triggered_by_id=worker_id,
        )
        self.repo.create_reads_for_admins(notification.id, org_id)
        self.db.commit()

    def notify_placement_created(
        self,
        org_id: UUID,
        placement_id: UUID,
        admin_id: UUID,
        client_id: UUID,
        masked_location: str,
        shift_description: str,
        requirements: str | None,
    ) -> None:
        notification = self.repo.create(
            org_id=org_id,
            type=NotificationType.placement_created,
            payload={
                "placement_id": str(placement_id),
                "masked_location": masked_location,
                "shift_description": shift_description,
                "requirements": requirements,
            },
            requires_action=True,
            target_audience=TargetAudience.workers_only,
            about_client_id=client_id,
            triggered_by_id=admin_id,
        )
        self.repo.create_reads_for_workers(notification.id, org_id)
        self.db.commit()

    # ── Worker-facing reads ───────────────────────────────────────────────────

    def list_for_current_worker(self) -> NotificationListResponse:
        member = self._resolve_member()
        rows = self.repo.list_for_worker(
            worker_id=member.id,
            org_id=member.org_id,
        )
        notifications = [
            self._to_response(notif, read)
            for notif, read in rows
        ]
        return NotificationListResponse(
            notifications=notifications,
            unread_count=self.repo.unread_count(member.id),
            action_needed_count=0,
        )

    # ── Admin-facing reads ────────────────────────────────────────────────────

    def list_for_current_admin(self) -> NotificationListResponse:
        member = self._resolve_member()
        rows = self.repo.list_for_admin(
            admin_id=member.id,
            org_id=member.org_id,
        )
        notifications = [
            self._to_response(notif, read)
            for notif, read in rows
        ]
        return NotificationListResponse(
            notifications=notifications,
            unread_count=self.repo.unread_count(member.id),
            action_needed_count=self.repo.action_needed_count(member.org_id),
        )

    def mark_read(self, notification_id: UUID) -> None:
        member = self._resolve_member()
        self.repo.mark_read(notification_id, member.id)
        self.db.commit()

    def get_notification(self, notification_id: UUID):
        member = self._resolve_member()
        notification = self.repo.get_by_id(notification_id)
        if not notification or notification.org_id != member.org_id:
            raise AppError(status_code=404, code="NOT_FOUND", message="Notification not found")
        return notification

    def mark_resolved(self, notification_id: UUID) -> None:
        member = self._resolve_member()
        notification = self.repo.get_by_id(notification_id)
        if not notification or notification.org_id != member.org_id:
            raise AppError(status_code=404, code="NOT_FOUND", message="Notification not found")
        if not notification.requires_action:
            raise AppError(status_code=400, code="NOT_ACTIONABLE",
                           message="This notification does not require action")
        self.repo.mark_resolved(notification, member.id)
        self.repo.mark_read(notification_id, member.id)
        self.db.commit()

    # ── Internal ──────────────────────────────────────────────────────────────

    def _resolve_member(self) -> Employment:
        member = self.db.query(Employment).filter(
            Employment.id == self.current_user_id,
            Employment.deleted_at.is_(None),
        ).first()
        if not member:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")
        return member

    @staticmethod
    def _to_response(notif, read) -> NotificationResponse:
        about_worker = notif.about_worker
        return NotificationResponse(
            id=notif.id,
            type=notif.type,
            target_audience=notif.target_audience,
            about_worker_id=notif.about_worker_id,
            about_worker_first_name=about_worker.person.first_name if about_worker else None,
            about_worker_last_name=about_worker.person.last_name if about_worker else None,
            about_client_id=notif.about_client_id,
            triggered_by_id=notif.triggered_by_id,
            payload=notif.payload,
            requires_action=notif.requires_action,
            resolved_at=notif.resolved_at,
            created_at=notif.created_at,
            read_at=read.read_at if read else None,
        )
