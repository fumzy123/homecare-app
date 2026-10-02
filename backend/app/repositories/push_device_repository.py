from datetime import datetime, timezone
from app.models.push_device import PushDevice


class PushDeviceRepository:
    def __init__(self, db):
        self.db = db

    def get_locked(self, installation_id):
        return self.db.query(PushDevice).filter(PushDevice.id == installation_id).with_for_update().first()

    def save(self, installation_id, secret_hash, worker_id, token, app_id, existing):
        device = existing or PushDevice(id=installation_id, secret_hash=secret_hash)
        device.worker_id, device.token, device.app_id = worker_id, token, app_id
        device.updated_at = datetime.now(timezone.utc)
        self.db.add(device)

    def revoke(self, device):
        # Retain the proof so delayed registration cannot claim someone else's ID.
        device.token = None
        device.updated_at = datetime.now(timezone.utc)
