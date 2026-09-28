from app.core.exceptions import AppError
from app.domain.billing_access import billing_access
from app.repositories.organization_repository import OrganizationRepository


class BillingAccessService:
    def __init__(self, db, current_user):
        self.current_user = current_user
        self.org_repo = OrganizationRepository(db)

    def require_write(self):
        employment = self.org_repo.get_active_employment_for_user(self.current_user.id)
        if not employment:
            raise AppError(403, "FORBIDDEN", "Organization membership is required")
        self.require_org_write(employment.org_id)

    def require_org_write(self, org_id):
        org = self.org_repo.get_by_id(org_id)
        if not org:
            raise AppError(404, "NOT_FOUND", "Organization not found")
        if not billing_access(org).can_write:
            raise AppError(403, "BILLING_READ_ONLY",
                "Your agency is in read-only mode. You can view records and invoices. Ask the agency owner to resolve billing before making changes.")
