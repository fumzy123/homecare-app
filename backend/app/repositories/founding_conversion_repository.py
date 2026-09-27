from sqlalchemy import or_
from app.models.founding_conversion import FoundingConversion
from app.models.founding_offer import FoundingOffer


class FoundingConversionRepository:
    def __init__(self, db):
        self.db = db

    def get_for_org(self, org_id):
        return self.db.query(FoundingConversion).filter(FoundingConversion.org_id == org_id).first()

    def add(self, conversion):
        self.db.add(conversion)

    def pending_org_ids(self, horizon):
        # There can only be three paid founders. Include canceled offers so their
        # pending schedules are released, rather than silently leaving them live.
        return [row.org_id for row in self.db.query(FoundingOffer.org_id).outerjoin(
            FoundingConversion, FoundingConversion.org_id == FoundingOffer.org_id,
        ).filter(
            FoundingOffer.protection_ends_at <= horizon,
            or_(FoundingConversion.id.is_(None), FoundingConversion.status.in_(("pending", "scheduled"))),
        ).all()]
