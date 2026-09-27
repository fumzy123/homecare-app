from app.models.base import Base as Base
from app.models.organization import Organization as Organization
from app.models.trial_activation import TrialActivation as TrialActivation
from app.models.billing_agreement import BillingAgreement as BillingAgreement
from app.models.billing_period import BillingPeriod as BillingPeriod
from app.models.founding_offer import FoundingOffer as FoundingOffer
from app.models.founding_offer import FoundingSlot as FoundingSlot
from app.models.founding_conversion import FoundingConversion as FoundingConversion
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

from app.models.billing_visit_evidence import BillingVisitEvidence as BillingVisitEvidence

from app.models.billing_usage_snapshot import BillingUsageSnapshot as BillingUsageSnapshot
