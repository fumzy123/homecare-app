from datetime import datetime, timezone
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import joinedload
from sqlalchemy.dialects.postgresql import insert
from app.models.activity import ActivityEvent, ActivityRead, OvertimeRequest
from app.models.admin_notification import Notification, NotificationRead
from app.models.employment import Employment
from app.core.enums import (
    TargetAudience,
    NotificationType,
    OrgMemberRole,
    OVERTIME_APPROVERS,
)


def can_bill(member):
    return member.role == OrgMemberRole.owner


class ActivityRepository:
    def __init__(self, db):
        self.db = db

    def record(
        self, org_id, actor_id, situation_key, category, title, detail="", target=None
    ):
        event = ActivityEvent(
            org_id=org_id,
            actor_id=actor_id,
            situation_key=situation_key,
            category=category,
            title=title,
            detail=detail,
            target=target or {},
        )
        self.db.add(event)
        return event

    def record_for_user(
        self,
        org_id,
        current_user,
        situation_key,
        category,
        title,
        detail="",
        target=None,
    ):
        from app.repositories.organization_repository import OrganizationRepository

        member = OrganizationRepository(self.db).get_active_employment_for_user(
            current_user.id
        )
        if member and member.org_id == org_id:
            return self.record(
                org_id, member.id, situation_key, category, title, detail, target
            )

    def events(self, member):
        query = (
            self.db.query(ActivityEvent, ActivityRead.read_at, Employment)
            .outerjoin(
                ActivityRead,
                and_(
                    ActivityRead.event_id == ActivityEvent.id,
                    ActivityRead.member_id == member.id,
                ),
            )
            .outerjoin(Employment, Employment.id == ActivityEvent.actor_id)
            .options(joinedload(Employment.person))
            .filter(ActivityEvent.org_id == member.org_id)
        )
        if not can_bill(member):
            query = query.filter(ActivityEvent.category != "billing")
        return query

    def notices(self, member):
        query = (
            self.db.query(Notification, NotificationRead.read_at)
            .outerjoin(
                NotificationRead,
                and_(
                    NotificationRead.notification_id == Notification.id,
                    NotificationRead.recipient_id == member.id,
                ),
            )
            .options(
                joinedload(Notification.about_worker).joinedload(Employment.person)
            )
            .filter(
                Notification.org_id == member.org_id,
                Notification.target_audience.in_(
                    [TargetAudience.admins_only, TargetAudience.all]
                ),
            )
        )
        if not can_bill(member):
            query = query.filter(
                Notification.type.notin_(
                    [
                        NotificationType.billing_payment_failed,
                        NotificationType.billing_trial_reminder,
                        NotificationType.billing_annual_reminder,
                        NotificationType.founding_conversion_notice,
                    ]
                )
            )
        if member.role not in OVERTIME_APPROVERS:
            query = query.filter(
                or_(
                    Notification.type != NotificationType.overtime_approval_requested,
                    Notification.triggered_by_id == member.id,
                )
            )
        return query

    def unread_by_situation(self, member):
        notices = (
            self.notices(member)
            .with_entities(Notification.situation_key, func.count(Notification.id))
            .filter(NotificationRead.read_at.is_(None))
            .group_by(Notification.situation_key)
            .all()
        )
        events = (
            self.events(member)
            .with_entities(ActivityEvent.situation_key, func.count(ActivityEvent.id))
            .filter(
                ActivityRead.read_at.is_(None),
                or_(
                    ActivityEvent.actor_id != member.id,
                    ActivityEvent.actor_id.is_(None),
                ),
            )
            .group_by(ActivityEvent.situation_key)
            .all()
        )
        result = {}
        for key, count in notices + events:
            result[key] = result.get(key, 0) + count
        return result

    def mark_read(self, member, event_ids, notification_ids):
        # Reapply visibility and tenant checks to each requested ID.
        events = (
            self.events(member).filter(ActivityEvent.id.in_(event_ids)).all()
            if event_ids
            else []
        )
        notices = (
            self.notices(member).filter(Notification.id.in_(notification_ids)).all()
            if notification_ids
            else []
        )
        now = datetime.now(timezone.utc)
        if events:
            self.db.execute(
                insert(ActivityRead)
                .values(
                    [
                        {"event_id": event.id, "member_id": member.id, "read_at": now}
                        for event, _, _ in events
                    ]
                )
                .on_conflict_do_nothing()
            )
        if notices:
            statement = insert(NotificationRead).values(
                [
                    {
                        "notification_id": notice.id,
                        "recipient_id": member.id,
                        "read_at": now,
                    }
                    for notice, _ in notices
                ]
            )
            self.db.execute(
                statement.on_conflict_do_update(
                    index_elements=["notification_id", "recipient_id"],
                    set_={"read_at": now},
                )
            )

    def pending_overtime(self, member):
        query = self.db.query(OvertimeRequest).filter(
            OvertimeRequest.org_id == member.org_id, OvertimeRequest.status == "pending"
        )
        if member.role not in OVERTIME_APPROVERS:
            query = query.filter(OvertimeRequest.requested_by == member.id)
        return query.all()

    def overtime(self, org_id, notification_id, lock=False):
        query = self.db.query(OvertimeRequest).filter(
            OvertimeRequest.org_id == org_id,
            OvertimeRequest.notification_id == notification_id,
        )
        return (query.with_for_update().populate_existing() if lock else query).first()

    def add_overtime(self, request):
        self.db.add(request)

    def unread_notices(self, member):
        return self.notices(member).filter(NotificationRead.read_at.is_(None)).all()

    def unresolved_payments(self, member):
        return (
            self.notices(member)
            .filter(
                Notification.type == NotificationType.billing_payment_failed,
                Notification.resolved_at.is_(None),
            )
            .all()
        )

    def history_rows(self, member, scope, situation, start, end, cursor, limit, kind):
        events, notices = self.events(member), self.notices(member)
        if scope == "mine":
            events = events.filter(ActivityEvent.actor_id == member.id)
            notices = notices.filter(Notification.triggered_by_id == member.id)
        if situation:
            events = events.filter(ActivityEvent.situation_key == situation)
            notices = notices.filter(Notification.situation_key == situation)
        if start:
            events = events.filter(
                ActivityEvent.created_at >= start, ActivityEvent.created_at < end
            )
            notices = notices.filter(
                Notification.created_at >= start, Notification.created_at < end
            )
        if cursor:
            stamp, source, ident = cursor

            def before(model, table_source):
                return or_(
                    model.created_at < stamp,
                    and_(model.created_at == stamp, model.id < ident),
                    and_(
                        model.created_at == stamp,
                        model.id == ident,
                        table_source < source,
                    ),
                )

            events = events.filter(before(ActivityEvent, "event"))
            notices = notices.filter(before(Notification, "notice"))
        return (
            events.order_by(ActivityEvent.created_at.desc(), ActivityEvent.id.desc())
            .limit(limit + 1)
            .all()
            if kind != "update"
            else [],
            notices.order_by(Notification.created_at.desc(), Notification.id.desc())
            .limit(limit + 1)
            .all()
            if kind != "completed"
            else [],
        )
