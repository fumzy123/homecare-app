from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.services.weekly_care_plan_service import WeeklyCarePlanService
from app.schemas.weekly_care_plan import WeeklyCarePlanPutSchema, WeeklyCarePlanEntryResponse

router = APIRouter(tags=["Weekly Care Plan"])


def get_weekly_care_plan_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> WeeklyCarePlanService:
    return WeeklyCarePlanService(db, current_user)


@router.get("/clients/{client_id}/care-plan", response_model=list[WeeklyCarePlanEntryResponse])
async def get_care_plan(
    client_id: UUID,
    service: WeeklyCarePlanService = Depends(get_weekly_care_plan_service),
):
    return service.get_for_client(client_id)


@router.put("/clients/{client_id}/care-plan", response_model=list[WeeklyCarePlanEntryResponse])
async def put_care_plan(
    client_id: UUID,
    payload: WeeklyCarePlanPutSchema,
    service: WeeklyCarePlanService = Depends(get_weekly_care_plan_service),
):
    return service.replace_for_client(client_id, payload)
