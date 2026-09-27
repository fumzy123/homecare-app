"""Stage evidence inside the caller's scheduling transaction; never commit here.

Callers must lock the parent shift before reading or changing it. Ordinary
series edits preserve facts; explicit occurrence corrections append versions.
"""
from app.domain.billing_usage import HISTORICAL_STATUSES
from app.domain.scheduling import resolve_effective_occurrence, shift_has_occurrence_on
from app.models.billing_visit_evidence import BillingVisitEvidence
from app.repositories.billing_evidence_repository import BillingEvidenceRepository


class BillingEvidenceService:
    def __init__(self, db, org_id):
        self.db = db
        self.org_id = org_id
        self.evidence_repo = BillingEvidenceRepository(db)

    def preserve(self, shift):
        latest = {row.occurrence_date: row for row in self.evidence_repo.for_shift(self.org_id, shift.id)}
        for mod in shift.modifications:
            if (mod.original_date not in latest and mod.completion_status in HISTORICAL_STATUSES
                    and shift_has_occurrence_on(shift, mod.original_date, include_truncated_history=True)):
                occurrence = resolve_effective_occurrence(shift, mod.original_date, mod)
                row = BillingVisitEvidence(
                    org_id=self.org_id, shift_id=shift.id, occurrence_date=mod.original_date,
                    revision=1, client_id=shift.client_id, modification_id=mod.id,
                    local_start=occurrence.start_time, completion_status=mod.completion_status.value,
                    source="schedule_preservation",
                )
                self.evidence_repo.add(row)
                latest[mod.original_date] = row
        return latest

    def correct(self, shift, mod, latest, changed_fields, *, source="visit_correction"):
        previous = latest.get(mod.original_date)
        if not previous and mod.completion_status not in HISTORICAL_STATUSES:
            return
        if not previous and not shift_has_occurrence_on(shift, mod.original_date, include_truncated_history=True):
            return
        occurrence = resolve_effective_occurrence(shift, mod.original_date, mod)
        start = (previous.local_start if previous and "new_start_time" not in changed_fields
                 else occurrence.start_time)
        client_id = previous.client_id if previous else shift.client_id
        status = mod.completion_status.value
        if previous and (previous.local_start, previous.completion_status) == (start, status):
            return
        self.evidence_repo.add(BillingVisitEvidence(
            org_id=self.org_id, shift_id=shift.id, occurrence_date=mod.original_date,
            revision=previous.revision + 1 if previous else 1, client_id=client_id,
            modification_id=mod.id, local_start=start, completion_status=status,
            source=source,
        ))
