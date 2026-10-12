from app.models.founding_offer import FoundingOffer, FoundingSlot


class FoundingOfferRepository:
    def __init__(self, db):
        self.db = db

    def lock_slots(self):
        # Every allocation/release locks the same seeded rows in a fixed order.
        # Unlike COUNT(), this remains safe when there are no offers yet.
        return self.db.query(FoundingSlot).order_by(FoundingSlot.slot_number).populate_existing().with_for_update().all()

    def get_for_org(self, org_id):
        return self.db.query(FoundingOffer).filter(FoundingOffer.org_id == org_id).first()

    def list_offers(self):
        return self.db.query(FoundingOffer).order_by(FoundingOffer.reserved_at).all()

    def add(self, offer):
        self.db.add(offer)
