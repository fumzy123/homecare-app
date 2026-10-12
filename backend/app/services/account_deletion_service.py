"""Privileged operator workflow. No router exposes this service to workers/admins."""
import hashlib
import json
from datetime import datetime, timezone

from app.core.enums import EmploymentStatus, OrgMemberRole
from app.repositories.account_deletion_repository import AccountDeletionRepository


class DeletionReviewError(ValueError):
    """Safe operator-facing error that does not include credentials or profile data."""


class AccountDeletionService:
    def __init__(self, db, auth_admin):
        self.db = db
        self.auth_admin = auth_admin
        self.account_deletion_repo = AccountDeletionRepository(db)

    def _review(self, plan, *, lock=False):
        repo = self.account_deletion_repo
        if lock:
            repo.lock_invitation_writes()
        person = repo.person(plan.person_id, lock=lock)
        if not person or str(person.supabase_user_id) != str(plan.expected_auth_user_id):
            raise DeletionReviewError("Person/auth identity changed or cleanup already completed; review the case again")
        employments = repo.employments(person.id, lock=lock)
        if {e.id for e in employments} != set(plan.expected_employment_ids):
            raise DeletionReviewError("Employment history changed; review every membership again")
        if any(e.role != OrgMemberRole.home_support_worker for e in employments):
            raise DeletionReviewError("This tool handles former-worker accounts only; an administrator/owner needs separate review")
        if any(e.deleted_at is None or e.employment_status != EmploymentStatus.terminated for e in employments):
            raise DeletionReviewError("An employment is still open; coordinate access separately, without automatically terminating employment")
        if repo.owns_organization(plan.expected_auth_user_id):
            raise DeletionReviewError("An organization is owned by this identity; resolve ownership separately")
        if repo.pending_invitation_count(person):
            raise DeletionReviewError("A pending invitation exists; coordinate the request and invitation before proceeding")
        worker_ids = [e.id for e in employments]
        counts = repo.cleanup_counts(person.id, worker_ids)
        # Include profile values only in the digest, never in preview/receipt output.
        snapshot = {
            "plan": plan.model_dump(mode="json"),
            "person": {c.name: getattr(person, c.name) for c in person.__table__.columns},
            "employments": [{c.name: getattr(e, c.name) for c in e.__table__.columns} for e in employments],
            "counts": counts,
        }
        digest = hashlib.sha256(json.dumps(snapshot, sort_keys=True, default=str).encode()).hexdigest()
        preview = {
            "status": "preview_only",
            "person_id": str(person.id),
            "auth_user_id": str(plan.expected_auth_user_id),
            "employment_ids": [str(e.id) for e in employments],
            "review_token": digest,
            "remove_profile_fields": plan.remove_profile_fields,
            "replace_email": plan.replace_email,
            "remove_availability": plan.remove_availability,
            "counts": counts,
            "retention": [r.model_dump(mode="json") for r in plan.retention],
            "remaining_work": "Review retained records, credential files, provider copies and backup expiry; notify the requester separately. This tool does not close the privacy case.",
        }
        return person, worker_ids, preview

    def preview(self, plan):
        try:
            return self._review(plan)[2]
        finally:
            self.db.rollback()

    @staticmethod
    def _is_missing_user(error):
        return str(getattr(error, "status", "")) == "404" and getattr(error, "code", None) == "user_not_found"

    def _delete_auth(self, person, auth_id):
        try:
            result = self.auth_admin.get_user_by_id(str(auth_id))
        except Exception as error:
            if self._is_missing_user(error):
                return  # Retry after Auth succeeded but the database transaction failed.
            raise DeletionReviewError("Auth identity lookup failed; no database cleanup was committed") from None
        user = result.user if result else None
        if not user or str(user.id) != str(auth_id) or (user.email or "").casefold() != person.email.casefold():
            raise DeletionReviewError("Auth identity does not match the reviewed person; stop and investigate")
        try:
            self.auth_admin.delete_user(str(auth_id), should_soft_delete=False)
        except Exception as error:
            if not self._is_missing_user(error):
                raise DeletionReviewError("Auth deletion failed or its result is unknown; preview and retry after checking provider status") from None

    def execute(self, plan, review_token, *, record_phase):
        """Auth is not transactional with SQL. Persist receipt phases for recovery."""
        try:
            today = datetime.now(timezone.utc).date()
            if not plan.identity_verified or not plan.agency_reviewed:
                raise DeletionReviewError("Verify identity and complete agency retention review before execution")
            if any(r.review_on <= today for r in plan.retention):
                raise DeletionReviewError("Each retained category needs a future review date")
            person, worker_ids, preview = self._review(plan, lock=True)
            if review_token != preview["review_token"]:
                raise DeletionReviewError("The preview is stale or the plan changed; generate and review a fresh preview")
            record_phase("review_validated")
            self._delete_auth(person, plan.expected_auth_user_id)
            record_phase("auth_deleted")
            self.account_deletion_repo.remove_account_data(person, worker_ids, plan)
            self.db.commit()
            record_phase("database_committed")
            return {**preview, "status": "account_cleanup_completed_case_review_still_required"}
        except Exception:
            self.db.rollback()
            raise
