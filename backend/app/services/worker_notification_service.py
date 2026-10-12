from app.core.enums import NotificationType, TargetAudience
from app.domain.push import CONTENT
from app.repositories.notification_repository import NotificationRepository
from app.repositories.push_delivery_repository import PushDeliveryRepository


class WorkerNotificationService:
    """Enlist inbox and phone delivery in the calling scheduling transaction."""
    def __init__(self, db, org_id, current_employment_id):
        self.notification_repo = NotificationRepository(db)
        self.push_delivery_repo = PushDeliveryRepository(db)
        self.org_id = org_id
        self.current_employment_id = current_employment_id

    def schedule(self, kind, worker_id, shift_id=None, occurrence_date=None):
        title, body = CONTENT[kind]
        notice = self.notification_repo.create(org_id=self.org_id, type=NotificationType(kind),
            payload={'message': f'{title}. {body}', 'shift_id': str(shift_id) if shift_id else None,
                     'occurrence_date': str(occurrence_date) if occurrence_date else None},
            requires_action=False, target_audience=TargetAudience.individual,
            recipient_id=worker_id, triggered_by_id=self.current_employment_id)
        self.notification_repo.create_read_for_individual(notice.id, worker_id)
        self.push_delivery_repo.enqueue(notice, worker_id)

    def changed(self, before, shift, occurrence_date=None):
        from app.domain.push import schedule_snapshot
        after = schedule_snapshot(shift)
        if before == after:
            return
        if before[0] != shift.worker_id:
            self.schedule('shift_cancelled', before[0], shift.id, occurrence_date)
            self.schedule('shift_assigned', shift.worker_id, shift.id, occurrence_date)
        else:
            self.schedule('shift_updated', shift.worker_id, shift.id, occurrence_date)
