from datetime import datetime, timezone
from uuid import uuid4
from app.core.config import settings
from app.core.exceptions import AppError
from app.models.billing_review_request import BillingReviewRequest
from app.repositories.billing_review_repository import BillingReviewRepository
from app.repositories.trial_activation_repository import TrialActivationRepository


def review_data(row):
    return {name: getattr(row, name) for name in (
        "id", "org_id", "period_id", "submitted_at", "message", "status", "response", "resolved_at")}


class BillingReviewService:
    def __init__(self, db, current_user, org_id=None):
        self.db, self.current_user, self.org_id = db, current_user, org_id
        self.review_repo = BillingReviewRepository(db)
        self.activation_repo = TrialActivationRepository(db)

    def _period(self, period_id):
        if self.org_id is None or self.review_repo.period(self.org_id, period_id) is None:
            raise AppError(404, "NOT_FOUND", "Billing period not found")

    def list(self, period_id):
        self._period(period_id)
        return [review_data(row) for row in self.review_repo.for_period(self.org_id, period_id)]

    def submit(self, period_id, request_id, message):
        message = message.strip()
        if not 10 <= len(message) <= 1000:
            raise AppError(422, "INVALID_MESSAGE", "Describe the billing question in 10–1000 characters")
        try:
            # Serialize retries without making the browser's request ID global.
            if self.org_id is None or not self.activation_repo.lock_organization(self.org_id):
                raise AppError(404, "NOT_FOUND", "Organization not found")
            self._period(period_id)
            row = self.review_repo.by_request(self.org_id, request_id)
            if row:
                if row.period_id != period_id or row.message != message:
                    raise AppError(409, "REQUEST_CHANGED", "This request was already submitted with different details")
            else:
                row = BillingReviewRequest(id=uuid4(), org_id=self.org_id, period_id=period_id,
                    request_id=request_id, submitted_by=self.current_user.id,
                    submitted_at=datetime.now(timezone.utc), message=message, status="open")
                self.review_repo.add(row)
            self.db.flush()
            result = review_data(row)
            self.db.commit()
            return result
        except Exception:
            self.db.rollback()
            raise

    def _operator(self):
        if not self.current_user or str(self.current_user.id) not in settings.billing_operator_user_ids:
            raise AppError(403, "FORBIDDEN", "Care Harbor billing operators only")

    def queue(self):
        self._operator()
        rows = self.review_repo.queue()
        return dict(requests=[{**review_data(row), "agency_name": name} for row, name in rows[:100]],
                    has_more=len(rows) > 100)

    def resolve(self, request_id, response):
        self._operator()
        response = response.strip()
        if not 10 <= len(response) <= 1000:
            raise AppError(422, "INVALID_RESPONSE", "Explain the outcome in 10–1000 characters")
        try:
            row = self.review_repo.lock(request_id)
            if not row:
                raise AppError(404, "NOT_FOUND", "Review request not found")
            if row.status == "resolved":
                if row.response != response:
                    raise AppError(409, "REVIEW_ALREADY_RESOLVED", "The recorded response cannot be overwritten")
            else:
                row.status, row.response = "resolved", response
                row.resolved_by, row.resolved_at = self.current_user.id, datetime.now(timezone.utc)
            result = review_data(row)
            self.db.commit()
            return result
        except Exception:
            self.db.rollback()
            raise
