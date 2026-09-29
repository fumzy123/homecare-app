from datetime import datetime, timezone
from uuid import uuid4
import stripe

from app.core.config import settings
from app.core.exceptions import AppError
from app.domain.trials import trial_window
from app.models.trial_activation import TrialActivation
from app.repositories.trial_activation_repository import TrialActivationRepository


class TrialActivationService:
    """Own activation-request transactions; Stripe processing is a later stage."""

    def __init__(self, db, current_user=None):
        self.db = db
        self.current_user = current_user
        self.trial_activation_repo = TrialActivationRepository(db)

    def request_start(self, org_id, *, now=None):
        if not settings.billing_onboarding_enabled:
            raise AppError(409, "ONBOARDING_DISABLED", "New billing onboarding is not enabled")
        if self.current_user and str(self.current_user.id) not in settings.billing_operator_user_ids:
            raise AppError(403, "FORBIDDEN", "Care Harbor billing operators only")
        now = now or datetime.now(timezone.utc)
        try:
            org = self.trial_activation_repo.lock_organization(org_id)
            if org is None:
                raise AppError(404, "NOT_FOUND", "Organization not found")
            if org.onboarding_deadline_at is None:
                raise AppError(409, "NOT_ENROLLED", "Organization is not enrolled in onboarding")
            existing = self.trial_activation_repo.get_for_org(org_id)
            if existing:
                # Completion after the automatic deadline remains useful history.
                if self.current_user and org.onboarding_completed_at is None:
                    org.onboarding_completed_at = now
                    self.db.commit()  # Persist the completion date before a retryable Stripe update.
                    org = self.trial_activation_repo.lock_organization(org_id)
                if (self.current_user and existing.source == "purchase"
                        and org.onboarding_completed_at and existing.starts_at > org.onboarding_completed_at):
                    window = trial_window(org.onboarding_deadline_at, now=now,
                        onboarding_completed_at=org.onboarding_completed_at)
                    if org.subscription_id:
                        sub = stripe.Subscription.retrieve(org.subscription_id)
                        if sub.customer != org.stripe_customer_id or sub.status != "trialing":
                            raise AppError(409, "TRIAL_ALREADY_ENDED", "The subscription is no longer in its trial")
                        stripe.Subscription.modify(sub.id, trial_end=int(window.ends_at.timestamp()),
                            proration_behavior="none")
                    elif existing.stripe_attempted_at:
                        raise AppError(409, "ACTIVATION_PENDING", "Finish subscription recovery before changing its trial dates")
                    existing.starts_at, existing.ends_at = window.starts_at, window.ends_at
                    org.trial_starts_at, org.trial_ends_at = window.starts_at, window.ends_at
                self.db.commit()
                return self._response(existing)
            if org.subscription_id or org.trial_starts_at or org.trial_ends_at:
                raise AppError(409, "ALREADY_STARTED", "An existing subscription or trial needs reconciliation")
            if self.current_user and org.onboarding_completed_at is None:
                org.onboarding_completed_at = now
            window = trial_window(
                org.onboarding_deadline_at, now=now,
                onboarding_completed_at=org.onboarding_completed_at,
            )
            if window is None:
                raise AppError(409, "NOT_DUE", "The onboarding deadline has not arrived")
            request = TrialActivation(
                id=uuid4(), org_id=org.id, requested_at=now,
                requested_by=self.current_user.id if self.current_user else None,
                source="operator" if self.current_user else "backstop",
                starts_at=window.starts_at, ends_at=window.ends_at,
                status="needs_review" if window.ends_at <= now else "pending",
            )
            self.trial_activation_repo.add(request)
            self.db.commit()
            return self._response(request)
        except Exception:
            self.db.rollback()
            raise

    @staticmethod
    def _response(request):
        return {
            "activation_id": request.id,
            "status": request.status,
            "planned_trial_starts_at": request.starts_at,
            "planned_trial_ends_at": request.ends_at,
        }
