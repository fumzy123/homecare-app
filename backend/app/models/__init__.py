from app.models.base import Base
from app.models.organization import Organization
from app.models.org_member import OrgMember
from app.models.client import Client

# IMPORTANT: Whenever you create a new model (like Client or Worker), 
# you MUST import it into this file so Alembic knows it exists!
