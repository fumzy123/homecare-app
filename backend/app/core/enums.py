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