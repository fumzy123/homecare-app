from uuid import UUID
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.core.security import get_current_user
from app.db.session import get_db
from app.schemas.push_device import PushDeviceProof, PushDeviceRegistration
from app.services.push_device_service import PushDeviceService

router = APIRouter(tags=["Worker — Push devices"])


def get_push_device_service(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return PushDeviceService(db, current_user)


def get_push_device_cleanup_service(db: Session = Depends(get_db)):
    return PushDeviceService(db)


@router.put("/me/push-devices/{installation_id}", status_code=204)
def register_device(installation_id: UUID, payload: PushDeviceRegistration,
                    push_device_service=Depends(get_push_device_service)):
    push_device_service.register(installation_id, payload)
    return Response(status_code=204)


@router.post("/push-devices/{installation_id}/revoke", status_code=204)
def revoke_device(installation_id: UUID, payload: PushDeviceProof,
                  push_device_service=Depends(get_push_device_cleanup_service)):
    push_device_service.revoke(installation_id, payload)
    return Response(status_code=204)
