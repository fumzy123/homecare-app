import enum

class OrgMemberRole(str, enum.Enum):
    owner = "owner"
    agency_admin = "agency_admin"
    home_support_worker = "home_support_worker"