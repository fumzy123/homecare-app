from fastapi import APIRouter, Depends
from app.api.billing_access import require_operational_access
from app.api.routes import worker_notes
from app.api.routes import invitations, org_members, clients, organization, shifts, progress_notes, legal, leave, billing, worker_me, worker_shifts, credentials, notifications, compliance, placements, authorizations, weekly_care_plan

router = APIRouter(prefix="/api")

# Billing (including signed webhooks) and legal acceptance retain their own
# authorization. Every operational router shares the same write guard.
operations = APIRouter(dependencies=[Depends(require_operational_access)])

operations.include_router(invitations.router)
operations.include_router(organization.router)
operations.include_router(org_members.router)
operations.include_router(clients.router)
operations.include_router(shifts.router)
operations.include_router(progress_notes.router)
operations.include_router(leave.router)
router.include_router(legal.router)
router.include_router(billing.router)
operations.include_router(worker_me.router)
operations.include_router(worker_shifts.router)
operations.include_router(worker_notes.router)
operations.include_router(credentials.router)
operations.include_router(compliance.router)
operations.include_router(notifications.router)
operations.include_router(placements.router)
operations.include_router(authorizations.router)
operations.include_router(weekly_care_plan.router)
router.include_router(operations)
