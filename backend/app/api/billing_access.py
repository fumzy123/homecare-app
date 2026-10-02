"""API-wide operational write guard; billing and identity recovery stay available."""
from fastapi import Depends, Request
from sqlalchemy.orm import Session
from app.core.security import get_current_user
from app.db.session import get_db
from app.services.billing_access_service import BillingAccessService


def get_billing_access_service(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return BillingAccessService(db, current_user)


def require_operational_access(request: Request, service: BillingAccessService = Depends(get_billing_access_service)):
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    path = request.scope["route"].path
    if (request.method, path) in {
        ("POST", "/api/organization"),
        # The accepting user has no membership yet. OrgMemberService checks the
        # persisted invitation's organization before creating any records.
        ("POST", "/api/org-members"),
        ("DELETE", "/api/organization"),  # Account closure remains available.
        ("PATCH", "/api/notifications/{notification_id}/read"),
        ("PATCH", "/api/activity/read"),
    }:
        return
    service.require_write()
