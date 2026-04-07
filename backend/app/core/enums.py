import enum

class OrgMemberRole(str, enum.Enum):
    owner = "owner"
    admin = "agency_admin"
    worker = "home_support_worker"