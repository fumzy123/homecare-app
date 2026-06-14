from datetime import date, datetime, timezone
from uuid import UUID
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload, selectinload
from app.models.authorization import Authorization


class AuthorizationRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── Write ─────────────────────────────────────────────────────────────────

    def add(self, authorization: Authorization) -> Authorization:
        self.db.add(authorization)
        self.db.flush()
        return authorization

    def cancel(self, authorization: Authorization) -> Authorization:
        authorization.cancelled_at = datetime.now(timezone.utc)
        self.db.flush()
        return authorization

    # ── Read ──────────────────────────────────────────────────────────────────

    def get_by_id(self, authorization_id: UUID) -> Authorization | None:
        return (
            self.db.query(Authorization)
            .options(selectinload(Authorization.services), joinedload(Authorization.client))
            .filter(Authorization.id == authorization_id)
            .first()
        )

    def list_for_client(self, client_id: UUID, org_id: UUID) -> list[Authorization]:
        return (
            self.db.query(Authorization)
            .options(selectinload(Authorization.services))
            .filter(Authorization.client_id == client_id, Authorization.org_id == org_id)
            .order_by(Authorization.covering_start.desc())
            .all()
        )

    def list_active_for_client(self, client_id: UUID, org_id: UUID, on_date: date) -> list[Authorization]:
        """Authorizations in effect on `on_date`: not cancelled, not superseded,
        and the date falls within the covering window."""
        superseded_ids = (
            select(Authorization.supersedes_id)
            .where(Authorization.supersedes_id.isnot(None))
        )
        return (
            self.db.query(Authorization)
            .options(selectinload(Authorization.services))
            .filter(
                Authorization.client_id == client_id,
                Authorization.org_id == org_id,
                Authorization.cancelled_at.is_(None),
                Authorization.id.notin_(superseded_ids),
                Authorization.covering_start <= on_date,
                or_(Authorization.covering_end.is_(None), Authorization.covering_end >= on_date),
            )
            .all()
        )

    def is_superseded(self, authorization_id: UUID) -> bool:
        return (
            self.db.query(Authorization.id)
            .filter(Authorization.supersedes_id == authorization_id)
            .first()
            is not None
        )
