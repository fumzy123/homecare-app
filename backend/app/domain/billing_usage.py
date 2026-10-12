"""Read-only active-client estimates using the canonical occurrence resolver."""
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Iterable
from uuid import UUID
from zoneinfo import ZoneInfo

from app.core.enums import ShiftCompletionStatus, ShiftStatus
from app.domain.scheduling import expand_occurrences, resolve_effective_occurrence, shift_has_occurrence_on
from app.models.shift import Shift
from app.models.shift_modification import ShiftModification


QUALIFYING_STATUSES = frozenset((ShiftCompletionStatus.scheduled, ShiftCompletionStatus.in_progress,
                               ShiftCompletionStatus.completed, ShiftCompletionStatus.no_show))
HISTORICAL_STATUSES = frozenset((ShiftCompletionStatus.completed, ShiftCompletionStatus.no_show))


@dataclass(frozen=True)
class UsageWindow:
    starts_at: datetime
    ends_at: datetime
    agency_timezone: str

    def __post_init__(self):
        for instant in (self.starts_at, self.ends_at):
            if instant.tzinfo is None or instant.utcoffset() is None:
                raise ValueError("Usage boundaries must include a timezone")
        object.__setattr__(self, "starts_at", self.starts_at.astimezone(timezone.utc))
        object.__setattr__(self, "ends_at", self.ends_at.astimezone(timezone.utc))
        if not self.starts_at < self.ends_at:
            raise ValueError("Usage window must end after it starts")
        if self.ends_at - self.starts_at > timedelta(days=32):
            raise ValueError("Usage must be calculated in monthly windows, including annual plans")
        if not isinstance(self.agency_timezone, str) or not self.agency_timezone:
            raise ValueError("An explicit agency timezone is required")
        ZoneInfo(self.agency_timezone)  # Never fall back to the server/browser zone.

    @property
    def local_dates(self) -> tuple[date, date]:
        zone = ZoneInfo(self.agency_timezone)
        return self.starts_at.astimezone(zone).date(), self.ends_at.astimezone(zone).date()

    def contains_local_start(self, local: datetime) -> bool:
        """Resolve stored wall time without guessing across DST billing boundaries.

        Both folds normally fall in the same monthly window. If only one does,
        the stored timestamp cannot tell us which period owns the visit.
        Nonexistent local times likewise require correction before billing.
        """
        if local.tzinfo is not None:
            raise ValueError("Stored shift times must be local, timezone-naive values")
        zone = ZoneInfo(self.agency_timezone)
        instants = set()
        for fold in (0, 1):
            instant = local.replace(tzinfo=zone, fold=fold).astimezone(timezone.utc)
            if instant.astimezone(zone).replace(tzinfo=None) == local:
                instants.add(instant)
        if not instants:
            raise ValueError("A visit starts at a nonexistent daylight-saving time")
        membership = {self.starts_at <= instant < self.ends_at for instant in instants}
        if len(membership) != 1:
            raise ValueError("An ambiguous daylight-saving visit crosses a billing boundary")
        return membership.pop()


@dataclass(frozen=True)
class UsageCandidate:
    shift: Shift
    modifications: tuple[ShiftModification, ...]


@dataclass(frozen=True)
class CountedClient:
    client_id: UUID
    shift_id: UUID
    occurrence_date: date
    modification_id: UUID | None
    local_start: datetime
    completion_status: ShiftCompletionStatus


def active_clients(candidates: Iterable[UsageCandidate], window: UsageWindow, evidence=()) -> tuple[CountedClient, ...]:
    """One witness per client; stop evaluating their other visits after a match.

    This is a fresh estimate, never a permanent billable flag or an invoice.
    Registry/worker state does not erase visit evidence. Terminal occurrence
    records survive a canceled/deleted master; its unfulfilled visits do not.
    """
    counted = {}
    protected = {(row.shift_id, row.occurrence_date) for row in evidence
                 if row.completion_status not in ("scheduled", "in_progress")}
    first, last = window.local_dates
    for row in evidence:
        status = ShiftCompletionStatus(row.completion_status)
        if (status in HISTORICAL_STATUSES and row.client_id not in counted
                and first <= row.local_start.date() <= last
                and window.contains_local_start(row.local_start)):
            counted[row.client_id] = CountedClient(
                row.client_id, row.shift_id, row.occurrence_date, row.modification_id,
                row.local_start, status,
            )
    for candidate in candidates:
        shift = candidate.shift
        if shift.client_id in counted:
            continue
        live_master = shift.status == ShiftStatus.active and shift.deleted_at is None
        modifications = {mod.original_date: mod for mod in candidate.modifications}
        dates = set(expand_occurrences(shift, first, last)) if live_master else set()
        # Include moved-in visits even if the master starts after this period.
        # Orphan overrides that never belonged to the series cannot invent visits.
        for mod in candidate.modifications:
            # Expansion already verified these dates. Avoid reparsing and
            # traversing the recurrence rule for each in-window override.
            if mod.original_date in dates:
                continue
            historical = mod.completion_status in HISTORICAL_STATUSES
            if (mod.new_start_time is not None or historical) and shift_has_occurrence_on(
                shift, mod.original_date, include_truncated_history=historical,
            ):
                dates.add(mod.original_date)
        for occurrence_date in sorted(dates):
            if (shift.id, occurrence_date) in protected:
                continue
            mod = modifications.get(occurrence_date)
            occurrence = resolve_effective_occurrence(shift, occurrence_date, mod)
            if occurrence.completion_status not in QUALIFYING_STATUSES:
                continue
            if not live_master and occurrence.completion_status not in HISTORICAL_STATUSES:
                continue
            if not first <= occurrence.start_time.date() <= last:
                continue
            if window.contains_local_start(occurrence.start_time):
                counted[shift.client_id] = CountedClient(
                    client_id=shift.client_id, shift_id=shift.id, occurrence_date=occurrence_date,
                    modification_id=occurrence.modification_id, local_start=occurrence.start_time,
                    completion_status=occurrence.completion_status,
                )
                break
    return tuple(counted[key] for key in sorted(counted, key=str))


def usage_witnesses(clients, evidence):
    """Copy only billing facts; never embed client names or clinical data."""
    versions = {(row.shift_id, row.occurrence_date): row for row in evidence
                if row.completion_status in ("completed", "no_show")}
    return [{
        "client_id": str(client.client_id), "shift_id": str(client.shift_id),
        "occurrence_date": client.occurrence_date.isoformat(),
        "modification_id": str(client.modification_id) if client.modification_id else None,
        "local_start": client.local_start.isoformat(), "completion_status": client.completion_status.value,
        "evidence_id": str(versions[(client.shift_id, client.occurrence_date)].id)
            if (client.shift_id, client.occurrence_date) in versions else None,
        "evidence_revision": versions[(client.shift_id, client.occurrence_date)].revision
            if (client.shift_id, client.occurrence_date) in versions else None,
    } for client in clients]
