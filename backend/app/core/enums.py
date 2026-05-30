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
