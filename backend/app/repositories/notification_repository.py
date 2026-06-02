from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.admin_notification import AdminNotification, AdminNotificationRead
from app.models.org_member import OrgMember
from app.core.enums import NotificationType, ADMIN_ROLES, OVERTIME_APPROVERS


class NotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── Write ─────────────────────────────────────────────────────────────────

    def create(
        self,
        org_id: UUID,
        type: NotificationType,
        worker_id: UUID,
        payload: dict,
        requires_action: bool,
    ) -> AdminNotification:
        notification = AdminNotification(
            org_id=org_id,
            type=type,
            worker_id=worker_id,
            payload=payload,
            requires_action=requires_action,
        )
        self.db.add(notification)
        self.db.flush()
        return notification

    def create_reads_for_admins(self, notification_id: UUID, org_id: UUID) -> None:
        """Fan out: insert an unread row for every admin in the org."""
        admin_ids = self._get_admin_ids(org_id)
        for admin_id in admin_ids:
            self.db.add(AdminNotificationRead(
                notification_id=notification_id,
                admin_id=admin_id,
                read_at=None,
            ))
        self.db.flush()

    def create_reads_for_approvers(self, notification_id: UUID, org_id: UUID) -> None:
        """Fan out: insert an unread row for every owner/manager in the org only."""
        approver_ids = self._get_approver_ids(org_id)
        for approver_id in approver_ids:
            self.db.add(AdminNotificationRead(
                notification_id=notification_id,
                admin_id=approver_id,
                read_at=None,
            ))
        self.db.flush()

    def mark_read(self, notification_id: UUID, admin_id: UUID) -> None:
        read = (
            self.db.query(AdminNotificationRead)
            .filter(
                AdminNotificationRead.notification_id == notification_id,
                AdminNotificationRead.admin_id == admin_id,
            )
            .first()
        )
        if read and read.read_at is None:
            read.read_at = datetime.now(timezone.utc)
            self.db.flush()

    def mark_resolved(self, notification: AdminNotification, resolved_by: UUID) -> AdminNotification:
        notification.resolved_at = datetime.now(timezone.utc)
        notification.resolved_by = resolved_by
        self.db.flush()
        return notification

    def purge_old_reads(self, cutoff: datetime) -> int:
        """Delete read notifications older than cutoff. Returns rows deleted."""
        rows = (
            self.db.query(AdminNotification)
            .filter(
                AdminNotification.resolved_at.isnot(None),
                AdminNotification.created_at < cutoff,
            )
            .all()
        )
        count = len(rows)
        for row in rows:
            self.db.delete(row)
        self.db.flush()
        return count

    # ── Read ──────────────────────────────────────────────────────────────────

    def list_for_admin(
        self,
        admin_id: UUID,
        org_id: UUID,
        limit: int = 30,
    ) -> list[tuple[AdminNotification, AdminNotificationRead | None]]:
        """Return (notification, read_row) pairs for this admin, newest first."""
        rows = (
            self.db.query(AdminNotification, AdminNotificationRead)
            .outerjoin(
                AdminNotificationRead,
                and_(
                    AdminNotificationRead.notification_id == AdminNotification.id,
                    AdminNotificationRead.admin_id == admin_id,
                ),
            )
            .filter(AdminNotification.org_id == org_id)
            .order_by(AdminNotification.created_at.desc())
            .limit(limit)
            .all()
        )
        return rows

    def unread_count(self, admin_id: UUID) -> int:
        return (
            self.db.query(AdminNotificationRead)
            .filter(
                AdminNotificationRead.admin_id == admin_id,
                AdminNotificationRead.read_at.is_(None),
            )
            .count()
        )

    def action_needed_count(self, org_id: UUID) -> int:
        return (
            self.db.query(AdminNotification)
            .filter(
                AdminNotification.org_id == org_id,
                AdminNotification.requires_action.is_(True),
                AdminNotification.resolved_at.is_(None),
            )
            .count()
        )

    def resolve_credential_notification(
        self,
        org_id: UUID,
        worker_id: UUID,
        document_type: str,
        resolver_id: UUID,
    ) -> None:
        """Find the most recent unresolved credential_uploaded notification for this worker+doc_type and resolve it."""
        notification = (
            self.db.query(AdminNotification)
            .filter(
                AdminNotification.org_id == org_id,
                AdminNotification.worker_id == worker_id,
                AdminNotification.type == NotificationType.credential_uploaded,
                AdminNotification.resolved_at.is_(None),
                AdminNotification.payload["document_type"].astext == document_type,
            )
            .order_by(AdminNotification.created_at.desc())
            .first()
        )
        if notification:
            self.mark_resolved(notification, resolver_id)

    def get_by_id(self, notification_id: UUID) -> AdminNotification | None:
        return self.db.query(AdminNotification).filter(
            AdminNotification.id == notification_id
        ).first()

    # ── Internal ──────────────────────────────────────────────────────────────

    def _get_admin_ids(self, org_id: UUID) -> list[UUID]:
        members = (
            self.db.query(OrgMember.id)
            .filter(
                OrgMember.org_id == org_id,
                OrgMember.role.in_(ADMIN_ROLES),
                OrgMember.deleted_at.is_(None),
            )
            .all()
        )
        return [m.id for m in members]

    def _get_approver_ids(self, org_id: UUID) -> list[UUID]:
        members = (
            self.db.query(OrgMember.id)
            .filter(
                OrgMember.org_id == org_id,
                OrgMember.role.in_(OVERTIME_APPROVERS),
                OrgMember.deleted_at.is_(None),
            )
            .all()
        )
        return [m.id for m in members]
