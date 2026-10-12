from app.core.config import settings
from app.core.exceptions import AppError
from app.repositories.billing_operator_repository import BillingOperatorRepository
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.billing_agreement_repository import BillingAgreementRepository
from app.repositories.trial_activation_repository import TrialActivationRepository
from app.repositories.founding_offer_repository import FoundingOfferRepository
from app.repositories.founding_conversion_repository import FoundingConversionRepository
from app.services.billing_usage_service import BillingUsageService
from app.services.billing_period_recovery_service import BillingPeriodRecoveryService
from app.repositories.billing_webhook_repository import BillingWebhookRepository


class BillingOperatorService:
    def __init__(self, db, current_user):
        self.db, self.current_user = db, current_user
        self.operator_repo = BillingOperatorRepository(db)
        self.org_repo = OrganizationRepository(db)
        self.agreement_repo = BillingAgreementRepository(db)
        self.activation_repo = TrialActivationRepository(db)
        self.offer_repo = FoundingOfferRepository(db)
        self.conversion_repo = FoundingConversionRepository(db)

    def _operator(self):
        if not self.current_user or str(self.current_user.id) not in settings.billing_operator_user_ids:
            raise AppError(403, 'FORBIDDEN', 'Care Harbor billing operators only')

    def access(self):
        self._operator()
        return dict(is_operator=True, onboarding_enabled=settings.billing_onboarding_enabled,
                    settlement_enabled=settings.billing_settlement_enabled,
                    live_settlement_enabled=settings.billing_settlement_live_enabled)

    def agencies(self, search='', before=None):
        self._operator()
        rows = self.operator_repo.agencies(search.strip(), before)
        return dict(agencies=[dict(row._mapping) for row in rows[:20]],
                    next_cursor=rows[19].id if len(rows) > 20 else None)

    def webhooks(self):
        self._operator()
        rows = BillingWebhookRepository(self.db).failures()
        fields = ('event_id', 'event_type', 'state', 'attempts', 'received_at', 'updated_at',
                  'next_attempt_at', 'lease_until', 'error_code')
        return dict(events=[{key: getattr(row, key) for key in fields} for row in rows[:100]], has_more=len(rows) > 100)

    def _agency(self, org_id):
        self._operator()
        org = self.org_repo.get_by_id(org_id)
        if not org:
            raise AppError(404, 'NOT_FOUND', 'Organization not found')
        return org

    def agency(self, org_id):
        org = self._agency(org_id)
        agreement = self.agreement_repo.get_for_org(org_id)
        activation = self.activation_repo.get_for_org(org_id)
        offer = self.offer_repo.get_for_org(org_id)
        conversion = self.conversion_repo.get_for_org(org_id)
        return dict(organization={key: getattr(org, key) for key in (
            'id', 'name', 'subscription_status', 'onboarding_deadline_at', 'onboarding_completed_at',
            'trial_starts_at', 'trial_ends_at', 'billing_recovery_checked_at', 'billing_recovery_error', 'deleted_at')},
            plan=dict(code=agreement.plan_code, interval=agreement.base_interval,
                      card_saved=bool(agreement.payment_method_id), canceled=bool(agreement.canceled_at)) if agreement else None,
            activation=dict(status=activation.status, starts_at=activation.starts_at, ends_at=activation.ends_at,
                            requested_at=activation.requested_at, attempted_at=activation.stripe_attempted_at) if activation else None,
            founding=dict(slot=offer.slot_number, released=bool(offer.released_at), forfeited=bool(offer.forfeited_at),
                          protection_ends_at=offer.protection_ends_at) if offer else None,
            conversion=dict(status=conversion.status, effective_at=conversion.effective_at,
                            notice_at=conversion.notice_at) if conversion else None,
            issues=self.operator_repo.issues(org_id))

    def periods(self, org_id, before=None):
        self._agency(org_id)
        return BillingUsageService(self.db, self.current_user, org_id).history(before)

    def settlements(self, org_id, period_id):
        self._agency(org_id)
        return BillingUsageService(self.db, self.current_user, org_id).settlements(period_id)

    def recheck(self, org_id):
        self._agency(org_id)
        if not settings.billing_onboarding_enabled:
            raise AppError(409, 'ONBOARDING_DISABLED', 'Billing onboarding is disabled')
        self.db.commit()  # Release the discovery transaction before Stripe reads.
        try:
            count = BillingPeriodRecoveryService(self.db).recover(org_id)
            return dict(recovered_periods=count)
        except Exception as exc:
            # Recovery records its own error for operator inspection. Never reset
            # settlement attempts or issue a charge as part of this action.
            raise AppError(409, 'BILLING_REVIEW_REQUIRED', 'History could not be reconciled. Refresh the agency to inspect the recorded issue.') from exc
