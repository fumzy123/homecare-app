"""Automatic completion, serialized with schedule changes on the parent shift."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from app.core.enums import ShiftCompletionStatus
from app.domain.scheduling import expand_occurrences, resolve_effective_occurrence, shift_has_occurrence_on
from app.models.shift_modification import ShiftModification
from app.repositories.shift_repository import ShiftRepository, ShiftModificationRepository
from app.services.billing_evidence_service import BillingEvidenceService
from app.services.billing_cutoff_service import BillingCutoffService


def _has_ended(local_end, zone, now):
    # Wait through both folds; never invent an instant for a DST gap.
    instants = {local_end.replace(tzinfo=zone, fold=fold).astimezone(timezone.utc) for fold in (0, 1)}
    valid = [instant for instant in instants
             if instant.astimezone(zone).replace(tzinfo=None) == local_end]
    return bool(valid) and max(valid) < now


class ShiftCompletionService:
    def __init__(self, db):
        self.db = db
        self.shift_repo = ShiftRepository(db)
        self.cutoff_service = BillingCutoffService(db)
        self.modification_repo = ShiftModificationRepository(db)

    def complete(self, now=None):
        now = now or datetime.now(timezone.utc)
        org_ids = self.shift_repo.completion_org_ids()
        self.db.commit()  # End discovery before taking an agency lock.
        try:
            for org_id in org_ids:
                self.cutoff_service.seal_due(org_id)
                for shift, zone, onboarding_deadline in self.shift_repo.completion_candidates(org_id):
                    # Legacy agencies retain UTC; enrolled agencies must choose a zone.
                    if not zone and onboarding_deadline is not None:
                        continue
                    local_now = now.astimezone(ZoneInfo(zone or "UTC")).replace(tzinfo=None)
                    first = (local_now - timedelta(days=2)).date()
                    mods = {m.original_date: m for m in shift.modifications}
                    dates = set(expand_occurrences(shift, first, local_now.date()))
                    dates.update(m.original_date for m in mods.values()
                                 if m.new_start_time and first <= m.new_start_time.date() <= local_now.date()
                                 and shift_has_occurrence_on(shift, m.original_date))
                    evidence_service = BillingEvidenceService(self.db, shift.org_id)
                    evidence = evidence_service.preserve(shift)
                    for day in sorted(dates):
                        previous = evidence.get(day)
                        if previous and previous.completion_status != "scheduled":
                            continue
                        mod = mods.get(day)
                        occurrence = resolve_effective_occurrence(shift, day, mod)
                        if occurrence.completion_status != ShiftCompletionStatus.scheduled:
                            continue
                        if not _has_ended(occurrence.end_time, ZoneInfo(zone or "UTC"), now):
                            continue
                        if mod is None:
                            mod = ShiftModification(shift_id=shift.id, original_date=day,
                                                    completion_status=ShiftCompletionStatus.completed)
                            self.modification_repo.add(mod)
                        else:
                            mod.completion_status = ShiftCompletionStatus.completed
                        self.db.flush()
                        evidence_service.correct(shift, mod, evidence, {"completion_status"}, source="automatic_completion")
                self.db.commit()
        except Exception:
            self.db.rollback()
            raise
