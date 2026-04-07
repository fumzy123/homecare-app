from fastapi import APIRouter
from app.api.routes import auth, org_members

router = APIRouter(prefix="/api")

router.include_router(auth.router, prefix="/auth", tags=["Auth"])
router.include_router(org_members.router, prefix="/org-members", tags=["Org Members"])