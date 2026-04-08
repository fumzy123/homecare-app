from fastapi import APIRouter
from app.api.routes import auth, org_members, clients, workers, organization

router = APIRouter(prefix="/api")

router.include_router(auth.router, prefix="/auth", tags=["Auth"])
router.include_router(organization.router, prefix="/organization", tags=["Organization"])
router.include_router(org_members.router, prefix="/org-members", tags=["Org Members"])
router.include_router(clients.router, prefix="/clients", tags=["Clients"])
router.include_router(workers.router, prefix="/workers", tags=["Workers"])