from fastapi import APIRouter, Depends, Response

from app.core.security import require_admin
from app.schemas.address import AddressSearch, AddressSearchResponse
from app.services.address_service import AddressService

router = APIRouter(prefix="/addresses", tags=["Addresses"])


def get_address_service(current_user=Depends(require_admin)) -> AddressService:
    return AddressService(current_user)


@router.post("/autocomplete", response_model=AddressSearchResponse)
async def autocomplete(
    payload: AddressSearch,
    response: Response,
    address_service: AddressService = Depends(get_address_service),
):
    # POST keeps typed addresses out of routine access-log URLs.
    response.headers["Cache-Control"] = "no-store"
    return await address_service.search(payload.text)
