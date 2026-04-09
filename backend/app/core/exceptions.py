from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(HTTPException):
    """
    Standard application exception. Raise this instead of HTTPException
    anywhere in the codebase so all errors return a consistent envelope.
    """
    def __init__(self, status_code: int, code: str, message: str, details=None):
        super().__init__(status_code=status_code)
        self.code = code
        self.message = message
        self.details = details


# ─────────────────────────────────────────
# Handler functions — registered in main.py
# ─────────────────────────────────────────

async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Handles all deliberate AppError exceptions raised by the application."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handles Pydantic request validation errors (wrong field types, missing fields etc.)"""
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request data",
                "details": exc.errors(),
            }
        },
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all for any unexpected exception. Never leaks internal details
    (stack traces, SQL errors, table names) to the client.
    """
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": None,
            }
        },
    )
