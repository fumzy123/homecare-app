from typing import Literal
from pydantic import BaseModel, Field


class PushDeviceProof(BaseModel):
    secret: str = Field(pattern=r"^[a-f0-9]{64}$", repr=False)


class PushDeviceRegistration(PushDeviceProof):
    token: str = Field(pattern=r"^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$", max_length=256, repr=False)
    app_id: Literal["com.homecareapp.worker.staging", "com.homecareapp.worker"]
