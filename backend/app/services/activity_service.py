from datetime import datetime, time, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo
from app.core.exceptions import AppError
from app.domain.activity import notification_content
from app.repositories.activity_repository import ActivityRepository
from app.repositories.organization_repository import OrganizationRepository
from app.schemas.activity import ActivityEntry, ActivityPage


class ActivityService:
    def __init__(self, db, current_user):
        self.db = db
        self.activity_repo = ActivityRepository(db)
        org_repo = OrganizationRepository(db)
        self.member = org_repo.get_active_employment_for_user(current_user.id)
        if not self.member:
            raise AppError(404, "NOT_FOUND", "Member not found")
        org = org_repo.get_by_id(self.member.org_id)
        self.timezone = org.billing_timezone or "America/St_Johns"

    def list_entries(
        self,
        scope="agency",
        day=None,
        situation=None,
        cursor=None,
        limit=30,
        kind="all",
    ):
        tz = ZoneInfo(self.timezone)
        today = datetime.now(tz).date()
        start = end = parsed_cursor = None
        if day:
            start = datetime.combine(day, time.min, tzinfo=tz).astimezone(timezone.utc)
            end = datetime.combine(
                day + timedelta(days=1), time.min, tzinfo=tz
            ).astimezone(timezone.utc)
        if cursor:
            try:
                stamp, source, raw_id = cursor.split("|")
                stamp, ident = datetime.fromisoformat(stamp), UUID(raw_id)
                if stamp.tzinfo is None or source not in ("event", "notice"):
                    raise ValueError()
            except (ValueError, TypeError):
                raise AppError(400, "INVALID_CURSOR", "Invalid activity cursor")

            parsed_cursor = (stamp, source, ident)
        events, notices = self.activity_repo.history_rows(
            self.member, scope, situation, start, end, parsed_cursor, limit, kind
        )
        entries = []
        if kind != "update":
            for event, read_at, actor in events:
                entries.append(
                    ActivityEntry(
                        id=f"event:{event.id}",
                        situation_key=event.situation_key,
                        category=event.category,
                        kind="completed",
                        title=event.title,
                        detail=event.detail,
                        mine=event.actor_id == self.member.id,
                        actor=f"{actor.person.first_name} {actor.person.last_name}"
                        if actor
                        else None,
                        created_at=event.created_at,
                        unread=read_at is None and event.actor_id != self.member.id,
                        target=event.target or None,
                    )
                )
        if kind != "completed":
            for notice, read_at in notices:
                category, title, detail, target = notification_content(notice)
                entries.append(
                    ActivityEntry(
                        id=f"notice:{notice.id}",
                        situation_key=notice.situation_key or f"notice:{notice.id}",
                        category=category,
                        kind="update",
                        title=title,
                        detail=detail,
                        created_at=notice.created_at,
                        mine=notice.triggered_by_id == self.member.id,
                        unread=read_at is None,
                        target=target,
                    )
                )
        entries.sort(
            key=lambda e: (e.created_at, e.id.split(":")[1], e.id.split(":")[0]),
            reverse=True,
        )
        page = entries[:limit]
        next_cursor = None
        if len(entries) > limit:
            last = page[-1]
            source, ident = last.id.split(":")
            next_cursor = f"{last.created_at.isoformat()}|{source}|{ident}"
        return ActivityPage(
            entries=page, next_cursor=next_cursor, today=today, timezone=self.timezone
        )

    def mark_read(self, payload):
        try:
            self.activity_repo.mark_read(
                self.member, payload.event_ids, payload.notification_ids
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
