import enum

class OrgMemberRole(str, enum.Enum):
    owner = "owner"
    agency_admin = "agency_admin"
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

class RecurrenceFrequency(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"