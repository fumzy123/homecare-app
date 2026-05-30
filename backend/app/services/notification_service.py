from uuid import UUID
from sqlalchemy.orm import Session
from app.models.org_member import OrgMember
from app.core.enums import NotificationType
from app.core.exceptions import AppError
from app.repositories.notification_repository import NotificationRepository
from app.schemas.notification import NotificationResponse, NotificationListResponse


class NotificationService:
    def __init__(self, db: Session, current_user_id: UUID | None = None):
        self.db = db
        self.current_user_id = current_user_id
        self.repo = NotificationRepository(db)

    # ── Called from BackgroundTasks (no current_user needed) ──────────────────

    def notify_credential_uploaded(
        self, org_id: UUID, worker_id: UUID, document_type: str
    ) -> None:
        notification = self.repo.create(
            org_id=org_id,
            type=NotificationType.credential_uploaded,
            worker_id=worker_id,
            payload={"document_type": document_type},
            requires_action=True,
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
            worker_id=worker_id,
            payload={"changed_fields": changed_fields},
            requires_action=False,
        )
        self.repo.create_reads_for_admins(notification.id, org_id)
        self.db.commit()

    def notify_shift_dropped(
        self, org_id: UUID, worker_id: UUID, shift_id: UUID,
        occurrence_date: str, client_name: str
    ) -> None:
        notification = self.repo.create(
            org_id=org_id,
            type=NotificationType.shift_dropped,
            worker_id=worker_id,
            payload={
                "shift_id": str(shift_id),
                "occurrence_date": occurrence_date,
                "client_name": client_name,
            },
            requires_action=True,
        )
        self.repo.create_reads_for_admins(notification.id, org_id)
        self.db.commit()

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

    def mark_resolved(self, notification_id: UUID) -> None:
        member = self._resolve_member()
        notification = self.repo.get_by_id(notification_id)
        if not notification or notification.org_id != member.org_id:
            raise AppError(status_code=404, code="NOT_FOUND", message="Notification not found")
        if not notification.requires_action:
            raise AppError(status_code=400, code="NOT_ACTIONABLE",
                           message="This notification does not require action")
        self.repo.mark_resolved(notification, member.id)
        # Also mark as read for this admin when they resolve it
        self.repo.mark_read(notification_id, member.id)
        self.db.commit()

    # ── Internal ──────────────────────────────────────────────────────────────

    def _resolve_member(self) -> OrgMember:
        member = self.db.query(OrgMember).filter(
            OrgMember.id == self.current_user_id
        ).first()
        if not member:
            raise AppError(status_code=404, code="NOT_FOUND", message="Member not found")
        return member

    @staticmethod
    def _to_response(notif, read) -> NotificationResponse:
        return NotificationResponse(
            id=notif.id,
            type=notif.type,
            worker_id=notif.worker_id,
            worker_first_name=notif.worker.first_name,
            worker_last_name=notif.worker.last_name,
            payload=notif.payload,
            requires_action=notif.requires_action,
            resolved_at=notif.resolved_at,
            created_at=notif.created_at,
            read_at=read.read_at if read else None,
        )
