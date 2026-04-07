# Import FastAPI
from fastapi import FastAPI, Depends
from app.core.security import get_current_user


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