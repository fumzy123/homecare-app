from fastapi import APIRouter
from app.api.routes import invitations, org_members, clients, workers, organization, shifts

router = APIRouter(prefix="/api")

router.include_router(invitations.router, prefix="/invitations", tags=["Invitations"])
router.include_router(organization.router, prefix="/organization", tags=["Organization"])
router.include_router(org_members.router, prefix="/org-members", tags=["Org Members"])
router.include_router(clients.router, prefix="/clients", tags=["Clients"])
router.include_router(workers.router, prefix="/workers", tags=["Workers"])
router.include_router(shifts.router, prefix="/shifts", tags=["Shifts"])