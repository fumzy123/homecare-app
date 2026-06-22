import enum

class OrgMemberRole(str, enum.Enum):
    owner = "owner"
    manager = "manager"
    supervisor = "supervisor"
    financial_officer = "financial_officer"
    nurse = "nurse"
    home_support_worker = "home_support_worker"

class ClientStatus(str, enum.Enum):
    active = "active"
    on_hold = "on_hold"
    discharged = "discharged"

class ServiceType(str, enum.Enum):
    personal_care = "personal_care"
    companionship = "companionship"
    respite = "respite"
    nursing = "nursing"
    homemaking = "homemaking"


class HoursPeriod(str, enum.Enum):
    per_week = "per_week"
    bi_weekly = "bi_weekly"
    per_month = "per_month"


class WeekDay(str, enum.Enum):
    MO = "MO"
    TU = "TU"
    WE = "WE"
    TH = "TH"
    FR = "FR"
    SA = "SA"
    SU = "SU"


class AuthorizationStatus(str, enum.Enum):
    """Derived/display only — never stored. Computed from covering dates,
    cancelled_at, and the supersede chain."""
    pending = "pending"
    active = "active"
    expired = "expired"
    superseded = "superseded"
    cancelled = "cancelled"


class AuthorizationCoverage(str, enum.Enum):
    """Derived. Whether an active client is currently covered by an
    active authorization."""
    covered = "covered"
    lapsed = "lapsed"


class CareArrangement(str, enum.Enum):
    """How a client's care is funded/governed.
    - self_pay: the agency schedules directly; no funder authorization, no caps.
    - funded: care is governed by a funder authorization; compliance applies."""
    self_pay = "self_pay"
    funded = "funded"

class EmploymentType(str, enum.Enum):
    full_time = "full_time"
    part_time = "part_time"
    casual = "casual"

class ShiftStatus(str, enum.Enum):
    active = "active"
    cancelled = "cancelled"

class ShiftCompletionStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    no_show = "no_show"
    cancelled = "cancelled"
    dropped = "dropped"

class RecurrenceFrequency(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"

class LeaveType(str, enum.Enum):
    sick = "sick"
    vacation = "vacation"
    bereavement = "bereavement"
    other = "other"

class EmploymentStatus(str, enum.Enum):
    active = "active"
    on_leave = "on_leave"
    terminated = "terminated"

class NotificationType(str, enum.Enum):
    profile_updated              = "profile_updated"
    credential_uploaded          = "credential_uploaded"
    shift_dropped                = "shift_dropped"
    overtime_approval_requested  = "overtime_approval_requested"
    placement_created            = "placement_created"
    placement_filled             = "placement_filled"
    placement_closed             = "placement_closed"

class TargetAudience(str, enum.Enum):
    admins_only = "admins_only"
    workers_only = "workers_only"
    all          = "all"
    individual   = "individual"

class PlacementStatus(str, enum.Enum):
    open   = "open"
    filled = "filled"
    closed = "closed"


# Roles that receive admin notifications. Kept here (not in security.py)
# so repositories can import it without a circular dependency.
ADMIN_ROLES = [
    OrgMemberRole.owner,
    OrgMemberRole.manager,
    OrgMemberRole.supervisor,
    OrgMemberRole.financial_officer,
    OrgMemberRole.nurse,
]

# Only these roles can approve statutory overtime (>40 h/week).
OVERTIME_APPROVERS = [
    OrgMemberRole.owner,
    OrgMemberRole.manager,
]


class ComplianceDocumentType(str, enum.Enum):
    first_aid_cpr = "first_aid_cpr"
    criminal_record_check = "criminal_record_check"
    vulnerable_sector_check = "vulnerable_sector_check"
    drivers_license = "drivers_license"
    child_access_check = "child_access_check"
    tb_test = "tb_test"
    immunization_record = "immunization_record"
    auto_insurance = "auto_insurance"
    work_permit = "work_permit"
    psw_certificate = "psw_certificate"
