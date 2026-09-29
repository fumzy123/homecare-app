from datetime import datetime, timedelta, timezone
from dateutil.relativedelta import relativedelta
from app.core.exceptions import AppError
from app.domain.billing import get_plan
from app.domain.billing_access import aware
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.billing_agreement_repository import BillingAgreementRepository
from app.repositories.founding_conversion_repository import FoundingConversionRepository
from app.repositories.billing_upcoming_repository import BillingUpcomingRepository


class BillingUpcomingService:
    """Read recorded billing obligations without creating periods or charging Stripe."""
    def __init__(self, db, current_user, org_id):
        self.org_id = org_id
        self.org_repo = OrganizationRepository(db)
        self.agreement_repo = BillingAgreementRepository(db)
        self.conversion_repo = FoundingConversionRepository(db)
        self.upcoming_repo = BillingUpcomingRepository(db)

    def summary(self, now=None):
        now = now or datetime.now(timezone.utc)
        org = self.org_repo.get_by_id(self.org_id)
        if not org:
            raise AppError(404, 'NOT_FOUND', 'Organization not found')
        if org.onboarding_deadline_at is None:
            raise AppError(409, 'NOT_ENROLLED', 'Upcoming usage applies to the new billing flow')
        agreement = self.agreement_repo.get_for_org(self.org_id)
        conversion = self.conversion_repo.get_for_org(self.org_id)
        base = self._base(org, agreement, conversion, now)
        corrections = [dict(row._mapping) for row in self.upcoming_repo.pending_corrections(self.org_id)]
        accrued_ids = set()
        periods = []
        for row in self.upcoming_repo.pending_periods(self.org_id, now):
            entry = dict(row._mapping)
            entry.pop('cutoff_state')
            if row.state == 'accrued' and row.usage_amount_cents is not None:
                # Approved corrections to unbilled annual usage are collected in
                # the same annual invoice, not separate payment transactions.
                accrued_ids.add(row.id)
                correction = sum(c['amount_cents'] for c in corrections if c['period_id'] == row.id)
                entry['usage_amount_cents'] += correction
                entry['adjustment_amount_cents'] = correction
            entry['state'] = ('needs_review' if row.state == 'needs_review' or row.cutoff_state == 'needs_review' else
                'awaiting_finalization' if row.usage_amount_cents is None else 'ready')
            periods.append(entry)
        annual = bool(agreement and agreement.base_interval == "year" and agreement.plan_version >= 2)
        return dict(calculated_at=now, base=base, periods=periods, annual_settlement=annual,
            collection_at=(aware(org.subscription_current_period_end) + timedelta(hours=72))
                if annual and org.subscription_current_period_end and org.subscription_status != "trialing" else None,
            corrections=[c for c in corrections if c['period_id'] not in accrued_ids],
            history_needs_review=bool(org.billing_recovery_error or (
                org.subscription_id and org.trial_ends_at and aware(org.trial_ends_at) <= now
                and not org.billing_recovery_checked_at)), tax_status='not_calculated')

    @staticmethod
    def _base(org, agreement, conversion, now):
        if not agreement:
            return dict(state='not_selected', amount_cents=None, scheduled_at=None, interval=None)
        result = dict(state='scheduled', amount_cents=None, scheduled_at=None, interval=agreement.base_interval)
        if agreement.canceled_at or org.subscription_status == 'canceled':
            return {**result, 'state': 'canceled'}
        plan = get_plan(agreement.plan_code, agreement.base_interval, version=agreement.plan_version)
        due = aware(org.trial_ends_at if org.subscription_status == 'trialing' else org.subscription_current_period_end)
        if org.subscription_status is None:
            return {**result, 'state': 'after_trial', 'amount_cents': plan.base_amount_cents}
        if org.subscription_status not in ('active', 'trialing') or not due or due <= now:
            return {**result, 'state': 'needs_review'}
        if agreement.plan_code == 'founding' and conversion and due >= aware(conversion.effective_at):
            if conversion.status not in ('scheduled', 'converted'):
                return {**result, 'state': 'needs_review'}
            plan = get_plan('standard', agreement.base_interval, version=conversion.target_plan_version)
        elif (agreement.plan_code == 'founding' and org.trial_ends_at
              and due >= aware(org.trial_ends_at) + relativedelta(months=12)):
            return {**result, 'state': 'needs_review'}
        return {**result, 'amount_cents': plan.base_amount_cents, 'scheduled_at': due,
                'state': 'first_payment' if org.subscription_status == 'trialing' else 'scheduled'}
