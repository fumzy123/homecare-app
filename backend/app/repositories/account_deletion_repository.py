"""Explicitly scoped cleanup. Never deletes Person, Employment or care records."""
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.models.activity import ActivityRead
from app.models.admin_notification import NotificationRead
from app.models.credential import Credential
from app.models.employment import Employment
from app.models.invitation import Invitation
from app.models.organization import Organization
from app.models.person import Person
from app.models.push_delivery import PushDelivery
from app.models.push_device import PushDevice
from app.models.worker_availability import WorkerAvailabilityEntry


class AccountDeletionRepository:
    def __init__(self, db: Session):
        self.db = db

    def lock_invitation_writes(self):
        # Serialize this rare operator action with invitation creation/acceptance.
        # A row lookup alone cannot prevent a new invite appearing after review.
        if self.db.get_bind().dialect.name == "postgresql":
            self.db.execute(text("LOCK TABLE invitations IN SHARE ROW EXCLUSIVE MODE"))

    def person(self, person_id, *, lock=False):
        query = self.db.query(Person).filter(Person.id == person_id)
        return (query.with_for_update() if lock else query).one_or_none()

    def employments(self, person_id, *, lock=False):
        query = self.db.query(Employment).filter(Employment.person_id == person_id).order_by(Employment.id)
        return (query.with_for_update() if lock else query).all()

    def pending_invitation_count(self, person):
        return self.db.query(Invitation).filter(or_(
            Invitation.supabase_user_id == person.supabase_user_id,
            func.lower(Invitation.email) == person.email.lower(),
        )).count()

    def owns_organization(self, auth_id):
        return self.db.query(Organization).filter(Organization.owner_id == auth_id).first() is not None

    def cleanup_counts(self, person_id, worker_ids):
        devices = self.db.query(PushDevice.id).filter(PushDevice.worker_id.in_(worker_ids))
        return {
            "push_devices": devices.count(),
            # A device can have old delivery rows for a different former owner.
            "push_deliveries": self.db.query(PushDelivery).filter(or_(
                PushDelivery.worker_id.in_(worker_ids), PushDelivery.device_id.in_(devices),
            )).count(),
            "notification_reads": self.db.query(NotificationRead).filter(NotificationRead.recipient_id.in_(worker_ids)).count(),
            "activity_reads": self.db.query(ActivityRead).filter(ActivityRead.member_id.in_(worker_ids)).count(),
            "availability": self.db.query(WorkerAvailabilityEntry).filter(WorkerAvailabilityEntry.person_id == person_id).count(),
            "retained_credentials": self.db.query(Credential).filter(Credential.person_id == person_id).count(),
        }

    def remove_account_data(self, person, worker_ids, plan):
        devices = self.db.query(PushDevice.id).filter(PushDevice.worker_id.in_(worker_ids))
        self.db.query(PushDelivery).filter(or_(
            PushDelivery.worker_id.in_(worker_ids), PushDelivery.device_id.in_(devices),
        )).delete(synchronize_session=False)
        self.db.query(PushDevice).filter(PushDevice.worker_id.in_(worker_ids)).delete(synchronize_session=False)
        self.db.query(NotificationRead).filter(NotificationRead.recipient_id.in_(worker_ids)).delete(synchronize_session=False)
        self.db.query(ActivityRead).filter(ActivityRead.member_id.in_(worker_ids)).delete(synchronize_session=False)
        if plan.remove_availability:
            self.db.query(WorkerAvailabilityEntry).filter(WorkerAvailabilityEntry.person_id == person.id).delete(synchronize_session=False)
        for field in plan.remove_profile_fields:
            setattr(person, field, None)
        if plan.replace_email:
            person.email = f"deleted-{person.id}@deleted.invalid"
        person.supabase_user_id = None
