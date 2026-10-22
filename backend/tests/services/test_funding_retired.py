from app.api.api import router
from app.schemas.client import ClientCreateSchema, ClientUpdateSchema, ClientResponse
from app.schemas.organization import OrganizationResponseSchema, OrganizationUpdateSchema


def test_no_funding_endpoints_or_client_contract_fields_remain():
    paths = {route.path for route in router.routes}
    assert not any('authorization' in path for path in paths)
    assert any('/care-need' in path for path in paths)
    assert any('/notes' in path for path in paths)
    for schema in (ClientCreateSchema, ClientUpdateSchema, ClientResponse):
        assert 'care_arrangement' not in schema.model_fields
        assert {'special_instructions', 'notes', 'medical_conditions', 'medications', 'allergies'} <= schema.model_fields.keys()
    for schema in (OrganizationResponseSchema, OrganizationUpdateSchema):
        assert 'uses_authorizations' not in schema.model_fields
