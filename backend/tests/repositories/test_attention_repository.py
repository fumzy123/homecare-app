from datetime import date, datetime, timedelta
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from app.core.enums import ComplianceDocumentType, EmploymentStatus, OrgMemberRole
from app.models.person import Person
from app.models.employment import Employment
from app.models.credential import Credential
from app.models.client import Client
from app.models.weekly_care_need import WeeklyCareNeed, CareSlot
from app.models.placement import Placement, PlacementInterest, CareSlotAssignment
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification
from app.models.authorization import Authorization
from app.repositories.attention_repository import AttentionRepository


@compiles(JSONB, 'sqlite')
def jsonb_as_json(_type, _compiler, **_kw):
    return 'JSON'


def test_credentials_scope_active_workers_and_expiry_boundaries():
    engine = create_engine('sqlite://')
    for model in [Person, Employment, Credential]:
        model.__table__.create(engine)
    today, org = date(2026, 10, 1), uuid4()
    with Session(engine) as db:
        def candidate(expiry=None, verified=True, **changes):
            person = Person(first_name='Sample', last_name='Worker', email=f'{uuid4()}@example.test')
            db.add(person)
            db.flush()
            employment = Employment(**(dict(person_id=person.id, org_id=org, role=OrgMemberRole.home_support_worker) | changes))
            credential = Credential(person_id=person.id, document_type=ComplianceDocumentType.first_aid_cpr,
                                    expiry_date=expiry, file_url='sample.pdf', verified_at=datetime.now() if verified else None)
            db.add_all([employment, credential])
            db.flush()
            return employment.id
        today_id = candidate(today)
        boundary = candidate(today + timedelta(days=30))
        uploaded = candidate(None, verified=False)
        for days in [-1, 31]:
            candidate(today + timedelta(days=days))
        candidate(today, org_id=uuid4())
        candidate(today, role=OrgMemberRole.owner)
        candidate(today, employment_status=EmploymentStatus.terminated)
        candidate(today, deleted_at=datetime.now())
        db.commit()
        assert {row[1] for row in AttentionRepository(db).credentials(org, today)} == {today_id, boundary, uploaded}
    engine.dispose()


def test_related_reads_enforce_tenant_latest_version_and_effective_visit_window():
    engine = create_engine('sqlite://')
    for model in [Client, WeeklyCareNeed, CareSlot, Placement, PlacementInterest, CareSlotAssignment, Shift, ShiftModification, Authorization]:
        model.__table__.create(engine)
    org, foreign, worker = uuid4(), uuid4(), uuid4()
    today = date(2026, 10, 1)
    with Session(engine) as db:
        def add(model, **values):
            row = model(**values)
            db.add(row)
            db.flush()
            return row
        def client(agency, **extra):
            return add(Client, org_id=agency, first_name='Sample', last_name='Client', date_of_birth=date(1940, 1, 1),
                       street='1 Example', city='Example', province='NL', postal_code='A1A1A1',
                       emergency_contact_name='Contact', emergency_contact_phone='555', emergency_contact_relationship='Family', **extra)
        local, other = client(org), client(foreign)
        deleted = client(org, deleted_at=datetime.now())
        for c in [local, other]:
            add(WeeklyCareNeed, client_id=c.id, org_id=c.org_id, version=1, effective_from=today)
        latest = add(WeeklyCareNeed, client_id=local.id, org_id=org, version=2, effective_from=today)
        other_need = add(WeeklyCareNeed, client_id=other.id, org_id=foreign, version=2, effective_from=today)
        places = [add(Placement, org_id=n.org_id, client_id=n.client_id, weekly_care_need_id=n.id,
                      created_by=worker, shift_description='Care', masked_location='Example') for n in [latest, other_need]]
        for p in places:
            add(CareSlotAssignment, placement_id=p.id, care_slot_id=uuid4(), employment_id=worker, approved_by=worker, starts_on=today)
        auths = [add(Authorization, org_id=c.org_id, client_id=c.id, funder='Example', authorization_number='A', covering_start=today) for c in [local, other]]
        def visit(c, agency, day, **extra):
            return add(Shift, org_id=agency, client_id=c.id, worker_id=worker, created_by=worker,
                       start_time=datetime.combine(day, datetime.min.time()), end_time=datetime.combine(day, datetime.min.time()) + timedelta(hours=1), **extra)
        visible = visit(local, org, today)
        moved = visit(local, org, today - timedelta(days=100))
        add(ShiftModification, shift_id=moved.id, original_date=moved.start_time.date(), new_start_time=datetime(2026, 10, 1, 9))
        visit(local, foreign, today)
        visit(other, org, today)
        visit(deleted, org, today)
        visit(local, org, today, deleted_at=datetime.now())
        visit(local, org, today - timedelta(days=100))
        db.commit()
        repo = AttentionRepository(db)
        assert {c.id for c in repo.clients(org)} == {local.id}
        assert [n.id for n in repo.care_needs(org)] == [latest.id]
        assert [p.id for p in repo.placements(org, [latest.id, other_need.id])] == [places[0].id]
        assert [p for p, _ in repo.assignments(org, [p.id for p in places])] == [places[0].id]
        assert [a.id for a in repo.authorizations(org)] == [auths[0].id]
        assert {s.id for s in repo.shifts(org, today, today)} == {visible.id, moved.id}
    engine.dispose()
