from fastapi import APIRouter
from app.api.routes import invitations, org_members, clients, organization, shifts, progress_notes, legal, leave, billing, worker_me, credentials, notifications

router = APIRouter(prefix="/api")

router.include_router(invitations.router)
router.include_router(organization.router)
router.include_router(org_members.router)
router.include_router(clients.router)
router.include_router(shifts.router)
router.include_router(progress_notes.router)
router.include_router(leave.router)
router.include_router(legal.router)
router.include_router(billing.router)
router.include_router(worker_me.router)
router.include_router(credentials.router)
router.include_router(notifications.router)
