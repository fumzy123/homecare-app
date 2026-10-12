from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.core.enums import EmploymentStatus, OrgMemberRole
from app.models.person import Person
from app.models.employment import Employment
from app.repositories.placement_repository import PlacementRepository


@compiles(JSONB, 'sqlite')
def jsonb_as_json(_type, _compiler, **_kw):
    return 'JSON'


def test_active_worker_query_enforces_agency_role_status_and_deletion():
    engine = create_engine('sqlite://')
    Person.__table__.create(engine)
    Employment.__table__.create(engine)
    org = uuid4()
    with Session(engine) as db:
        person = Person(first_name='Alex', last_name='Worker', email='alex@example.test')
        db.add(person)
        db.flush()
        candidates = []
        for changes in [{}, {'org_id': uuid4()}, {'role': OrgMemberRole.owner},
            {'employment_status': EmploymentStatus.on_leave}, {'employment_status': EmploymentStatus.terminated},
            {'deleted_at': datetime.now(timezone.utc)}]:
            candidate = Employment(**(dict(person_id=person.id, org_id=org, role=OrgMemberRole.home_support_worker,
                employment_status=EmploymentStatus.active) | changes))
            db.add(candidate)
            candidates.append(candidate)
        db.commit()
        repo = PlacementRepository(db)
        assert repo.active_worker(candidates[0].id, org).person.first_name == 'Alex'
        for candidate in candidates[1:]:
            assert repo.active_worker(candidate.id, org) is None
    engine.dispose()
