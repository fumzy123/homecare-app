from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_admin
from app.core.exceptions import AppError
from app.core.enums import PlacementStatus
from app.repositories.organization_repository import OrganizationRepository
from app.services.placement_service import PlacementService
from app.schemas.placement import (
    PlacementCreateSchema,
    PlacementFillSchema,
    PlacementCloseSchema,
    PlacementResponse,
    PlacementDetailResponse,
)

router = APIRouter(prefix="/placements", tags=["Placements"])


def get_placement_service(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
) -> PlacementService:
    employment = OrganizationRepository(db).get_active_employment_for_user(current_user.id)
    if not employment:
        raise AppError(status_code=404, code="NOT_FOUND", message="Member record not found")
    return PlacementService(db, current_user, org_id=employment.org_id)


# ─────────────────────────────────────────
# 1. Create a placement (post a client as available)
# ─────────────────────────────────────────
@router.post("", response_model=PlacementDetailResponse)
async def create_placement(
    payload: PlacementCreateSchema,
    service: PlacementService = Depends(get_placement_service),
):
    return service.create_placement(payload)


# ─────────────────────────────────────────
# 2. List placements for this org
# ─────────────────────────────────────────
@router.get("", response_model=list[PlacementResponse])
async def list_placements(
    status: PlacementStatus | None = Query(default=None),
    service: PlacementService = Depends(get_placement_service),
):
    return service.list_placements(status)


# ─────────────────────────────────────────
# 3. Get a single placement with interest list
# ─────────────────────────────────────────
@router.get("/{placement_id}", response_model=PlacementDetailResponse)
async def get_placement(
    placement_id: UUID,
    service: PlacementService = Depends(get_placement_service),
):
    return service.get_placement(placement_id)


# ─────────────────────────────────────────
# 4. Fill a placement — select a worker
# ─────────────────────────────────────────
@router.post("/{placement_id}/fill", response_model=PlacementDetailResponse)
async def fill_placement(
    placement_id: UUID,
    payload: PlacementFillSchema,
    service: PlacementService = Depends(get_placement_service),
):
    return service.fill_placement(placement_id, payload.employment_id)


# ─────────────────────────────────────────
# 5. Close a placement without filling it
# ─────────────────────────────────────────
@router.post("/{placement_id}/close", response_model=PlacementDetailResponse)
async def close_placement(
    placement_id: UUID,
    payload: PlacementCloseSchema,
    service: PlacementService = Depends(get_placement_service),
):
    return service.close_placement(placement_id)
