from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.security import get_current_user
from app.core.limiter import limiter
from app.core.exceptions import AppError, app_error_handler, validation_error_handler, unhandled_error_handler
from app.jobs.shift_completion import mark_shifts_completed

from app.db.session import engine

# Import models so SQLAlchemy knows they exist (DO NOT DELETE)
from app.models.organization import Organization # noqa: F401
from app.models.org_member import OrgMember      # noqa: F401

from app.api.api import router as api_router

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(mark_shifts_completed, "interval", minutes=15)
    scheduler.start()
    yield
    scheduler.shutdown()


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        headers={"Retry-After": str(exc.retry_after)},
        content={
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": f"Too many requests. Retry after {exc.retry_after} second(s).",
                "details": None,
            }
        },
    )


app = FastAPI(lifespan=lifespan)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://homecare-app-production-admin-frontend.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

app.include_router(api_router)


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/api/me")
def view_my_profile(current_user=Depends(get_current_user)):
    return {
        "message": "Welcome back! The Bouncer let you in.",
        "user_id": current_user.id,
        "email": current_user.email,
    }
