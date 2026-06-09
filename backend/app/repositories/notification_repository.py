from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from app.models.admin_notification import Notification, NotificationRead
from app.models.employment import Employment
from app.core.enums import NotificationType, TargetAudience, ADMIN_ROLES, OVERTIME_APPROVERS


class NotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── Write ─────────────────────────────────────────────────────────────────

    def create(
        self,
        org_id: UUID,
        type: NotificationType,
        payload: dict,
        requires_action: bool,
        target_audience: TargetAudience = TargetAudience.admins_only,
        about_worker_id: UUID | None = None,
        about_client_id: UUID | None = None,
        triggered_by_id: UUID | None = None,
        recipient_id: UUID | None = None,
    ) -> Notification:
        notification = Notification(
            org_id=org_id,
            type=type,
            target_audience=target_audience,
            about_worker_id=about_worker_id,
            about_client_id=about_client_id,
            triggered_by_id=triggered_by_id,
            recipient_id=recipient_id,
            payload=payload,
            requires_action=requires_action,
        )
        self.db.add(notification)
        self.db.flush()
        return notification

    def create_reads_for_admins(self, notification_id: UUID, org_id: UUID) -> None:
        """Fan out: insert an unread row for every admin in the org."""
        for emp_id in self._get_admin_ids(org_id):
            self.db.add(NotificationRead(
                notification_id=notification_id,
                recipient_id=emp_id,
                read_at=None,
            ))
        self.db.flush()

    def create_reads_for_approvers(self, notification_id: UUID, org_id: UUID) -> None:
        """Fan out: insert an unread row for every owner/manager in the org."""
        for emp_id in self._get_approver_ids(org_id):
            self.db.add(NotificationRead(
                notification_id=notification_id,
                recipient_id=emp_id,
                read_at=None,
            ))
        self.db.flush()

    def create_reads_for_workers(self, notification_id: UUID, org_id: UUID) -> None:
        """Fan out: insert an unread row for every HSW in the org."""
        for emp_id in self._get_worker_ids(org_id):
            self.db.add(NotificationRead(
                notification_id=notification_id,
                recipient_id=emp_id,
                read_at=None,
            ))
        self.db.flush()

    def create_read_for_individual(self, notification_id: UUID, recipient_id: UUID) -> None:
        self.db.add(NotificationRead(
            notification_id=notification_id,
            recipient_id=recipient_id,
            read_at=None,
        ))
        self.db.flush()

    def mark_read(self, notification_id: UUID, recipient_id: UUID) -> None:
        read = (
            self.db.query(NotificationRead)
            .filter(
                NotificationRead.notification_id == notification_id,
                NotificationRead.recipient_id == recipient_id,
            )
            .first()
        )
        if read and read.read_at is None:
            read.read_at = datetime.now(timezone.utc)
            self.db.flush()

    def mark_resolved(self, notification: Notification, resolved_by: UUID) -> Notification:
        notification.resolved_at = datetime.now(timezone.utc)
        notification.resolved_by = resolved_by
        self.db.flush()
        return notification

    def purge_old_reads(self, cutoff: datetime) -> int:
        rows = (
            self.db.query(Notification)
            .filter(
                Notification.resolved_at.isnot(None),
                Notification.created_at < cutoff,
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
    ) -> list[tuple[Notification, NotificationRead | None]]:
        """Return (notification, read_row) pairs for this admin, newest first."""
        rows = (
            self.db.query(Notification, NotificationRead)
            .options(joinedload(Notification.about_worker).joinedload(Employment.person))
            .outerjoin(
                NotificationRead,
                and_(
                    NotificationRead.notification_id == Notification.id,
                    NotificationRead.recipient_id == admin_id,
                ),
            )
            .filter(
                Notification.org_id == org_id,
                Notification.target_audience.in_([
                    TargetAudience.admins_only,
                    TargetAudience.all,
                ]),
            )
            .order_by(Notification.created_at.desc())
            .limit(limit)
            .all()
        )
        return rows

    def unread_count(self, recipient_id: UUID) -> int:
        return (
            self.db.query(NotificationRead)
            .filter(
                NotificationRead.recipient_id == recipient_id,
                NotificationRead.read_at.is_(None),
            )
            .count()
        )

    def action_needed_count(self, org_id: UUID) -> int:
        return (
            self.db.query(Notification)
            .filter(
                Notification.org_id == org_id,
                Notification.requires_action.is_(True),
                Notification.resolved_at.is_(None),
                Notification.target_audience.in_([
                    TargetAudience.admins_only,
                    TargetAudience.all,
                ]),
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
        notification = (
            self.db.query(Notification)
            .filter(
                Notification.org_id == org_id,
                Notification.about_worker_id == worker_id,
                Notification.type == NotificationType.credential_uploaded,
                Notification.resolved_at.is_(None),
                Notification.payload["document_type"].astext == document_type,
            )
            .order_by(Notification.created_at.desc())
            .first()
        )
        if notification:
            self.mark_resolved(notification, resolver_id)

    def get_by_id(self, notification_id: UUID) -> Notification | None:
        return self.db.query(Notification).filter(
            Notification.id == notification_id
        ).first()

    # ── Internal ──────────────────────────────────────────────────────────────

    def _get_admin_ids(self, org_id: UUID) -> list[UUID]:
        rows = (
            self.db.query(Employment.id)
            .filter(
                Employment.org_id == org_id,
                Employment.role.in_(ADMIN_ROLES),
                Employment.deleted_at.is_(None),
            )
            .all()
        )
        return [r.id for r in rows]

    def _get_approver_ids(self, org_id: UUID) -> list[UUID]:
        rows = (
            self.db.query(Employment.id)
            .filter(
                Employment.org_id == org_id,
                Employment.role.in_(OVERTIME_APPROVERS),
                Employment.deleted_at.is_(None),
            )
            .all()
        )
        return [r.id for r in rows]

    def _get_worker_ids(self, org_id: UUID) -> list[UUID]:
        from app.core.enums import OrgMemberRole
        rows = (
            self.db.query(Employment.id)
            .filter(
                Employment.org_id == org_id,
                Employment.role == OrgMemberRole.home_support_worker,
                Employment.deleted_at.is_(None),
            )
            .all()
        )
        return [r.id for r in rows]
