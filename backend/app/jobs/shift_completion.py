from app.db.session import SessionLocal
from app.services.shift_completion_service import ShiftCompletionService


def mark_shifts_completed() -> None:
    db = SessionLocal()
    try:
        ShiftCompletionService(db).complete()
    finally:
        db.close()
