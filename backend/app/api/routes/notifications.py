from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.services.notification_service import NotificationService
from app.schemas.notification import NotificationListResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def get_notification_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> NotificationService:
    return NotificationService(db, current_user_id=current_user.id)


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    notification_service: NotificationService = Depends(get_notification_service),
):
    return notification_service.list_for_current_admin()


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    notification_service: NotificationService = Depends(get_notification_service),
):
    notification_service.mark_read(notification_id)
    return {"ok": True}


@router.patch("/{notification_id}/resolve")
async def resolve_notification(
    notification_id: UUID,
    notification_service: NotificationService = Depends(get_notification_service),
):
    notification_service.mark_resolved(notification_id)
    return {"ok": True}
