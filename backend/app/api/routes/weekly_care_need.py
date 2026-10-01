from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.services.weekly_care_need_service import WeeklyCareNeedService
from app.schemas.weekly_care_need import WeeklyCareNeedCreate, WeeklyCareNeedResponse

router = APIRouter(tags=["Weekly Care Need"])


def get_weekly_care_need_service(
    current_user=Depends(require_admin), db: Session = Depends(get_db)
):
    return WeeklyCareNeedService(db, current_user)


@router.get(
    "/clients/{client_id}/care-need", response_model=list[WeeklyCareNeedResponse]
)
def get_care_need(
    client_id: UUID, weekly_care_need_service=Depends(get_weekly_care_need_service)
):
    return weekly_care_need_service.get_for_client(client_id)


@router.post("/clients/{client_id}/care-need", response_model=WeeklyCareNeedResponse)
def create_care_need(
    client_id: UUID,
    payload: WeeklyCareNeedCreate,
    weekly_care_need_service=Depends(get_weekly_care_need_service),
):
    return weekly_care_need_service.create_version(client_id, payload)


@router.get("/care-actions")
def care_actions(weekly_care_need_service=Depends(get_weekly_care_need_service)):
    return weekly_care_need_service.attention_items()
