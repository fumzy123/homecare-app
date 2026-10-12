"""Keep offset-aware inputs out of agency-local scheduling storage."""
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.shift import (
    ShiftCreateSchema, ShiftUpdateSchema, ShiftEditFromSchema,
    ShiftModificationCreateSchema, ShiftModificationUpdateSchema,
    OvertimeApprovalRequestSchema, OvertimeApproveSchema,
)


@pytest.mark.parametrize('schema,required,prefix', [
    (ShiftCreateSchema, {'worker_id': uuid4(), 'client_id': uuid4()}, ''),
    (ShiftUpdateSchema, {}, ''),
    (ShiftEditFromSchema, {'occurrence_date': '2026-09-30'}, 'new_'),
    (ShiftModificationCreateSchema, {'original_date': '2026-09-30'}, 'new_'),
    (ShiftModificationUpdateSchema, {}, 'new_'),
    (OvertimeApprovalRequestSchema, {
        'worker_id': uuid4(), 'week_start': '2026-09-28',
        'week_end': '2026-10-04', 'total_hours': 42,
    }, ''),
    (OvertimeApproveSchema, {'notification_id': uuid4()}, ''),
])
def test_shift_inputs_preserve_local_clock_time_and_reject_offsets(schema, required, prefix):
    start, end = prefix + 'start_time', prefix + 'end_time'
    payload = {**required, start: '2026-09-30T18:00:00', end: '2026-09-30T19:00:00'}
    parsed = schema.model_validate(payload)
    assert getattr(parsed, start).hour == 18
    assert getattr(parsed, start).tzinfo is None
    assert parsed.model_dump(mode='json')[start] == payload[start]
    for field in (start, end):
        for offset in ('Z', '-02:30', '-03:30', '+05:30'):
            with pytest.raises(ValidationError) as error:
                schema.model_validate({**payload, field: payload[field] + offset})
            assert any(e['type'] == 'timezone_naive' and e['loc'] == (field,)
                       for e in error.value.errors())
