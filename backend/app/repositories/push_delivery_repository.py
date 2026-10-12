from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.core.enums import EmploymentStatus, OrgMemberRole
from app.models.employment import Employment
from app.models.organization import Organization
from app.models.push_device import PushDevice
from app.models.push_delivery import PushDelivery


class PushDeliveryRepository:
    def __init__(self, db):
        self.db = db

    def _eligible_devices(self, worker_id, org_id):
        return self.db.query(PushDevice).join(Employment, Employment.id == PushDevice.worker_id).join(
            Organization, Organization.id == Employment.org_id).filter(
            PushDevice.worker_id == worker_id, Employment.org_id == org_id,
            Employment.role == OrgMemberRole.home_support_worker,
            Employment.employment_status == EmploymentStatus.active, Employment.deleted_at.is_(None),
            Organization.is_active.is_(True), Organization.deleted_at.is_(None), PushDevice.token.is_not(None))

    def enqueue(self, notification, worker_id):
        now = datetime.now(timezone.utc)
        for device in self._eligible_devices(worker_id, notification.org_id).all():
            self.db.add(PushDelivery(notification_id=notification.id, org_id=notification.org_id,
                worker_id=worker_id, device_id=device.id, token=device.token, app_id=device.app_id,
                kind=notification.type.value, created_at=now, next_attempt_at=now,
                expires_at=now + timedelta(hours=24)))

    def next_due(self, now, app_ids):
        return self.db.scalars(select(PushDelivery).where(
            PushDelivery.status.in_(['queued', 'receipt']), PushDelivery.next_attempt_at <= now,
            PushDelivery.app_id.in_(app_ids)).order_by(PushDelivery.next_attempt_at, PushDelivery.id)
            .limit(1).with_for_update(skip_locked=True)).first()

    def current_device(self, delivery):
        # Lock the registration during handoff so logout/reassignment cannot race it.
        return self._eligible_devices(delivery.worker_id, delivery.org_id).filter(
            PushDevice.id == delivery.device_id, PushDevice.token == delivery.token,
            PushDevice.app_id == delivery.app_id).with_for_update(of=PushDevice).first()

    def invalidate_token(self, delivery):
        # A delayed receipt must never revoke a newer token or another account.
        self.db.query(PushDevice).filter(PushDevice.id == delivery.device_id,
            PushDevice.worker_id == delivery.worker_id, PushDevice.token == delivery.token).update(
            {PushDevice.token: None}, synchronize_session='fetch')
