import json
from pathlib import Path
import pytest
from pydantic import ValidationError
from app.schemas.phone import normalize_phone
from app.schemas.client import ClientCreateSchema, ClientUpdateSchema
from app.schemas.org_member import OrgMemberUpdateSchema, OrgMemberSelfUpdateSchema
from app.schemas.worker_profile import WorkerProfileUpdateSchema

CASES = json.loads((Path(__file__).parent / 'fixtures/phone-cases.json').read_text())


@pytest.mark.parametrize('raw,expected', CASES['valid'])
def test_normalize(raw, expected):
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize('raw', CASES['invalid'] + [12345, {}, []])
def test_reject(raw):
    with pytest.raises(ValueError):
        normalize_phone(raw)


@pytest.mark.parametrize('schema', [ClientUpdateSchema, OrgMemberUpdateSchema, OrgMemberSelfUpdateSchema, WorkerProfileUpdateSchema])
def test_write_schema_normalizes_and_preserves_patch_semantics(schema):
    assert schema().model_dump(exclude_unset=True) == {}
    assert schema(phone_number='7095550123').phone_number == '+17095550123'
    assert schema(phone_number=' ').model_dump(exclude_unset=True) == {'phone_number': None}
    with pytest.raises(ValidationError):
        schema(phone_number='bad')


@pytest.mark.parametrize('raw', [None, '', '  ', '555'])
def test_client_emergency_cannot_be_cleared(raw):
    with pytest.raises(ValidationError):
        ClientUpdateSchema(emergency_contact_phone=raw)


def test_create_and_optional_emergency():
    client = ClientCreateSchema(first_name='Test', last_name='Only', date_of_birth='1950-01-01',
        street='1 Test', city='Test', province='NL', postal_code='A1A1A1',
        emergency_contact_name='Test', emergency_contact_relationship='Test', emergency_contact_phone='7095550123')
    assert client.emergency_contact_phone == '+17095550123'
    for schema in (OrgMemberUpdateSchema, WorkerProfileUpdateSchema):
        assert schema(emergency_contact_phone='').emergency_contact_phone is None
        assert schema(emergency_contact_phone='+44 20 7946 0018').emergency_contact_phone == '+442079460018'
