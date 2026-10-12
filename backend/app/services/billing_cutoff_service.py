"""Participation in the caller's transaction; lock agency before any shift lock.

Every scheduling writer seals overdue windows before changing data. A delayed
job therefore sees exactly the last accepted pre-deadline state. Changes admitted
under the agency lock before the deadline belong to the correction window.
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfoNotFoundError
from dateutil.relativedelta import relativedelta
from app.domain.billing_usage import UsageWindow, active_clients, usage_witnesses
from app.models.billing_usage_cutoff import BillingUsageCutoff
from app.repositories.billing_cutoff_repository import BillingCutoffRepository
from app.repositories.billing_usage_repository import BillingUsageRepository
from app.repositories.billing_evidence_repository import BillingEvidenceRepository


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


class BillingCutoffService:
    def __init__(self, db):
        self.db = db
        self.cutoff_repo = BillingCutoffRepository(db)
        self.usage_repo = BillingUsageRepository(db)
        self.evidence_repo = BillingEvidenceRepository(db)

    def capture_due(self, org_id, *, now=None):
        """Background capture owns its transaction; schedule writers use seal_due."""
        try:
            self.seal_due(org_id, now=now)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    def seal_due(self, org_id, *, now=None):
        org = self.cutoff_repo.lock_organization(org_id)
        # Capture time AFTER acquiring the lock, never before waiting for it.
        now = now or datetime.now(timezone.utc)
        if not org or org.onboarding_deadline_at is None or org.trial_ends_at is None or not org.subscription_id:
            return org
        if org.billing_usage_tracking_started_at is None:
            org.billing_usage_tracking_started_at = now
        if not org.billing_timezone:
            return org  # No guessed zone; finalization refuses missing cutoffs.
        anchor = utc(org.trial_ends_at)
        existing = {utc(row.starts_at) for row in self.cutoff_repo.for_subscription(org.id, org.subscription_id)}
        months = (now.year - anchor.year) * 12 + now.month - anchor.month
        for index in range(max(0, months + 1)):
            start, end = anchor + relativedelta(months=index), anchor + relativedelta(months=index + 1)
            deadline = end + timedelta(hours=72)
            if deadline > now or start in existing:
                continue
            row = BillingUsageCutoff(
                org_id=org.id, subscription_id=org.subscription_id, starts_at=start, ends_at=end,
                deadline_at=deadline, captured_at=now, agency_timezone=org.billing_timezone,
                state="needs_review", reason="TRACKING_STARTED_AFTER_DEADLINE",
            )
            if utc(org.billing_usage_tracking_started_at) < deadline:
                try:
                    window = UsageWindow(start, end, org.billing_timezone)
                    candidates = self.usage_repo.candidates(org.id, window)
                    evidence = self.evidence_repo.for_window(org.id, window, [c.shift.id for c in candidates])
                    row.clients = usage_witnesses(active_clients(candidates, window, evidence), evidence)
                    row.state, row.reason = "ready", None
                except (ValueError, ZoneInfoNotFoundError):
                    # Keep operations usable, but never silently bill an uncertain count.
                    row.reason = "USAGE_REVIEW_REQUIRED"
            self.cutoff_repo.add(row)
        self.db.flush()  # Caller may read the newly sealed cutoff with autoflush disabled.
        return org
