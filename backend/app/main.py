# Import FastAPI
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from app.core.security import get_current_user
from app.core.exceptions import AppError, app_error_handler, validation_error_handler, unhandled_error_handler


# Crea
from app.db.session import engine
# from app.models.base import Base (No longer needed since Alembic handles this)

# Import models so SQLAlchemy knows they exist (DO NOT DELETE)
from app.models.organization import Organization # noqa: F401
from app.models.org_member import OrgMember      # noqa: F401


# Import router
from app.api.api import router as api_router

# [Alembic now handles database table creation. Base.metadata.create_all removed!]


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handlers — all errors return a consistent JSON envelope
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

# Mount all Routers
app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "Hello World"}

# Here is our first Protected Route!
@app.get("/api/me")
def view_my_profile(current_user = Depends(get_current_user)):
    # This route will only execute if the user passes the Bouncer in security.py
    return {
        "message": "Welcome back! The Bouncer let you in.",
        "user_id": current_user.id,
        "email": current_user.email
    }