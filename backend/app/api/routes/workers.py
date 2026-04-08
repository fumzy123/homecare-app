from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.services.worker_service import WorkerService
from app.core.security import require_admin
from app.schemas.worker import (
    WorkerProfileCreateSchema,
    WorkerProfileUpdateSchema,
    OrgMemberUpdateSchema,
    WorkerResponse,
)

router = APIRouter()


# ─────────────────────────────────────────
# 1. List all workers in the admin's org
# ─────────────────────────────────────────
@router.get("/", response_model=List[WorkerResponse])
async def get_all_workers(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await WorkerService.get_all_workers(current_user, db)


# ─────────────────────────────────────────
# 2. Get a single worker's full profile
# ─────────────────────────────────────────
@router.get("/{worker_id}", response_model=WorkerResponse)
async def get_worker(
    worker_id: str,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await WorkerService.get_worker(worker_id, current_user, db)


# ─────────────────────────────────────────
# 3. Create worker profile (extended data)
# Worker already exists via invite flow
# This fills in their worker_profiles row
# ─────────────────────────────────────────
@router.post("/{worker_id}/profile", response_model=WorkerResponse)
async def create_worker_profile(
    worker_id: str,
    payload: WorkerProfileCreateSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await WorkerService.create_worker_profile(worker_id, payload, current_user, db)


# ─────────────────────────────────────────
# 4. Update worker — org_member fields
# (name, phone, emergency contact, etc.)
# ─────────────────────────────────────────
@router.patch("/{worker_id}", response_model=WorkerResponse)
async def update_worker(
    worker_id: str,
    payload: OrgMemberUpdateSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await WorkerService.update_worker(worker_id, payload, current_user, db)


# ─────────────────────────────────────────
# 5. Update worker profile — worker_profiles fields
# (address, employment type, availability, etc.)
# ─────────────────────────────────────────
@router.patch("/{worker_id}/profile", response_model=WorkerResponse)
async def update_worker_profile(
    worker_id: str,
    payload: WorkerProfileUpdateSchema,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await WorkerService.update_worker_profile(worker_id, payload, current_user, db)


# ─────────────────────────────────────────
# 6. Soft delete a worker
# ─────────────────────────────────────────
@router.delete("/{worker_id}")
async def delete_worker(
    worker_id: str,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return await WorkerService.delete_worker(worker_id, current_user, db)
