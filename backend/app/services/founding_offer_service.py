from datetime import datetime, timezone

from app.core.config import settings
from app.core.exceptions import AppError
from app.domain.founding import protection_end, notice_due_at
from app.models.founding_offer import FoundingOffer
from app.repositories.founding_offer_repository import FoundingOfferRepository
from app.repositories.trial_activation_repository import TrialActivationRepository
from app.repositories.billing_agreement_repository import BillingAgreementRepository
from app.repositories.founding_conversion_repository import FoundingConversionRepository


class FoundingOfferService:
    def __init__(self, db, current_user=None):
        self.db = db
        self.current_user = current_user
        self.founding_offer_repo = FoundingOfferRepository(db)
        self.trial_activation_repo = TrialActivationRepository(db)
        self.agreement_repo = BillingAgreementRepository(db)
        self.conversion_repo = FoundingConversionRepository(db)

    def _operator(self):
        if not self.current_user or str(self.current_user.id) not in settings.billing_operator_user_ids:
            raise AppError(403, "FORBIDDEN", "Care Harbor billing operators only")

    def reserve(self, org_id):
        self._operator()
        try:
            org = self.trial_activation_repo.lock_organization(org_id)
            if not org:
                raise AppError(404, "NOT_FOUND", "Organization not found")
            existing = self.founding_offer_repo.get_for_org(org_id)
            if existing:
                if existing.released_at or existing.forfeited_at:
                    raise AppError(409, "FOUNDING_NOT_REUSABLE", "This agency cannot reclaim founding pricing")
                self.db.commit()
                return self._response(existing)
            if org.onboarding_deadline_at is None or org.subscription_id or self.agreement_repo.get_for_org(org_id):
                raise AppError(409, "FOUNDING_TOO_LATE", "Reserve the offer before the owner authorizes a billing plan")
            slots = self.founding_offer_repo.lock_slots()
            if [slot.slot_number for slot in slots] != [1, 2, 3]:
                raise AppError(503, "FOUNDING_NOT_CONFIGURED", "Founding slots are not configured")
            slot = next((s for s in slots if s.org_id is None and s.consumed_at is None), None)
            if slot is None:
                raise AppError(409, "FOUNDING_FULL", "All three founding places are allocated")
            slot.org_id = org.id
            offer = FoundingOffer(org_id=org.id, slot_number=slot.slot_number,
                                  reserved_at=datetime.now(timezone.utc), reserved_by=self.current_user.id)
            self.founding_offer_repo.add(offer)
            self.db.commit()
            return self._response(offer)
        except Exception:
            self.db.rollback()
            raise

    def release(self, org_id):
        self._operator()
        try:
            org = self.trial_activation_repo.lock_organization(org_id)
            if not org:
                raise AppError(404, "NOT_FOUND", "Organization not found")
            offer = self.founding_offer_repo.get_for_org(org_id)
            if not offer:
                raise AppError(404, "NOT_FOUND", "Founding reservation not found")
            if offer.released_at:
                self.db.commit()
                return self._response(offer)
            agreement = self.agreement_repo.get_for_org(org_id)
            # Never release authorized/possibly in-flight subscriptions. Releasing
            # a canceled authorized reservation needs explicit Stripe reconciliation.
            if org.subscription_id or agreement or offer.protection_starts_at:
                raise AppError(409, "FOUNDING_RELEASE_BLOCKED", "Only an unused reservation without billing authorization can be released")
            slots = self.founding_offer_repo.lock_slots()
            slot = next(s for s in slots if s.slot_number == offer.slot_number)
            if slot.consumed_at or slot.org_id != org.id:
                raise AppError(409, "FOUNDING_RELEASE_BLOCKED", "The slot is consumed or needs reconciliation")
            slot.org_id = None
            offer.released_at = datetime.now(timezone.utc)
            offer.released_by = self.current_user.id
            self.db.commit()
            return self._response(offer)
        except Exception:
            self.db.rollback()
            raise

    def list_offers(self):
        self._operator()
        result = []
        for offer in self.founding_offer_repo.list_offers():
            row = self._response(offer)
            conversion = self.conversion_repo.get_for_org(offer.org_id)
            row["conversion"] = {
                "status": conversion.status, "notice_at": conversion.notice_at,
                "effective_at": conversion.effective_at, "schedule_id": conversion.schedule_id,
                "target_price_id": conversion.target_price_id,
            } if conversion else None
            result.append(row)
        return result

    def record_paid_period(self, org_id, starts_at):
        """Called only for a verified paid invoice of this agency's subscription."""
        try:
            org = self.trial_activation_repo.lock_organization(org_id)
            if not org:
                return
            agreement = self.agreement_repo.get_for_org(org_id)
            offer = self.founding_offer_repo.get_for_org(org_id)
            if not agreement or agreement.plan_code != "founding" or not offer or offer.protection_starts_at:
                self.db.commit()
                return
            slot = next(s for s in self.founding_offer_repo.lock_slots() if s.slot_number == offer.slot_number)
            if slot.org_id != org.id or offer.released_at:
                raise AppError(409, "FOUNDING_RECONCILIATION", "Founding allocation does not match the paid subscription")
            offer.protection_starts_at = starts_at
            offer.protection_ends_at = protection_end(starts_at)
            slot.consumed_at = datetime.now(timezone.utc)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    @staticmethod
    def _response(offer):
        return {
            "org_id": offer.org_id, "slot_number": offer.slot_number,
            "reserved_at": offer.reserved_at, "released_at": offer.released_at,
            "forfeited_at": offer.forfeited_at,
            "protection_starts_at": offer.protection_starts_at,
            "protection_ends_at": offer.protection_ends_at,
            "conversion_notice_due_at": notice_due_at(offer.protection_ends_at) if offer.protection_ends_at else None,
        }
