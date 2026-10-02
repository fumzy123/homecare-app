import hashlib
import hmac
from sqlalchemy.exc import IntegrityError
from app.core.enums import EmploymentStatus, OrgMemberRole
from app.core.exceptions import AppError
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.push_device_repository import PushDeviceRepository


class PushDeviceService:
    def __init__(self, db, current_user=None):
        self.db, self.current_user = db, current_user
        self.push_device_repo = PushDeviceRepository(db)
        self.org_repo = OrganizationRepository(db)

    @staticmethod
    def _hash(secret):
        return hashlib.sha256(secret.encode()).hexdigest()

    def register(self, installation_id, payload):
        employment = self.org_repo.get_active_employment_for_user(self.current_user.id)
        if (not employment or employment.role != OrgMemberRole.home_support_worker
                or employment.employment_status != EmploymentStatus.active):
            raise AppError(403, "WORKER_ACCESS_REQUIRED", "Active worker access is required")
        org = self.org_repo.get_by_id(employment.org_id)
        if not org or not org.is_active or org.deleted_at is not None:
            raise AppError(403, "WORKER_ACCESS_REQUIRED", "Active agency access is required")
        try:
            existing = self.push_device_repo.get_locked(installation_id)
            proof = self._hash(payload.secret)
            if existing and not hmac.compare_digest(existing.secret_hash, proof):
                raise AppError(409, "DEVICE_REGISTRATION_CONFLICT", "This installation cannot be registered")
            self.push_device_repo.save(installation_id, proof, employment.id, payload.token, payload.app_id, existing)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise AppError(409, "DEVICE_REGISTRATION_CONFLICT", "Please retry device registration")
        except Exception:
            self.db.rollback()
            raise

    def revoke(self, installation_id, payload):
        # A device-only capability allows cleanup even after its login expires.
        # It cannot read records or enable delivery; responses reveal no existence.
        try:
            device = self.push_device_repo.get_locked(installation_id)
            if device and hmac.compare_digest(device.secret_hash, self._hash(payload.secret)):
                self.push_device_repo.revoke(device)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
