from fastapi import APIRouter
from app.api.routes import auth

router = APIRouter(prefix="/api")

router.include_router(auth.router, prefix="/auth", tags=["Auth"])