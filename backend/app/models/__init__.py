from app.models.base import Base as Base
from app.models.organization import Organization as Organization
from app.models.person import Person as Person
from app.models.employment import Employment as Employment
from app.models.client import Client as Client
from app.models.shift import Shift as Shift
from app.models.shift_modification import ShiftModification as ShiftModification
from app.models.invitation import Invitation as Invitation
from app.models.progress_note import ProgressNote as ProgressNote
from app.models.leave_record import LeaveRecord as LeaveRecord
from app.models.credential import Credential as Credential
from app.models.admin_notification import AdminNotification as AdminNotification
from app.models.admin_notification import AdminNotificationRead as AdminNotificationRead
from app.models.authorization import Authorization as Authorization
from app.models.authorization import AuthorizationService as AuthorizationService
from app.models.weekly_care_plan import WeeklyCarePlanEntry as WeeklyCarePlanEntry
from app.models.worker_availability import WorkerAvailabilityEntry as WorkerAvailabilityEntry

# IMPORTANT: Whenever you create a new model (like Client or Worker),
# you MUST import it into this file so Alembic knows it exists!
