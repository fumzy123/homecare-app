"""Read-only projection of the care requirement effective on a given date."""

from collections import defaultdict
from datetime import timedelta


def current_care_by_client(needs, on_date):
    result = {}
    for need in sorted(needs, key=lambda item: item.version, reverse=True):
        starts = need.scheduled_from or need.effective_from
        if (
            need.client_id not in result
            and (need.activated_at is not None or need.imported)
            and starts <= on_date
            and (need.ends_on is None or need.ends_on >= on_date)
        ):
            result[need.client_id] = need
    return result


def directory_care_by_client(needs, assignments, on_date):
    """Prefer current, then next approved care, then the latest proposal.

    Coverage means an assignment for each slot's next required occurrence, not
    an individual visit's completion/cancellation or a worker's expression of interest.
    """
    grouped = defaultdict(list)
    by_slot = defaultdict(list)
    for need in needs:
        grouped[need.client_id].append(need)
    for assignment in assignments:
        by_slot[assignment.care_slot_id].append(assignment)
    current = current_care_by_client(needs, on_date)
    weekdays = {day: index for index, day in enumerate(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])}
    result = {}
    for client_id, versions in grouped.items():
        latest = max(versions, key=lambda n: n.version)
        future = sorted(
            (n for n in versions
             if (n.activated_at is not None or n.imported)
             and (n.scheduled_from or n.effective_from) > on_date
             and (n.ends_on is None or n.ends_on >= (n.scheduled_from or n.effective_from))),
            key=lambda n: (n.scheduled_from or n.effective_from, -n.version),
        )
        proposed = latest if not latest.activated_at and not latest.imported and latest.ends_on is None else None
        selected = current.get(client_id) or (future[0] if future else None) or proposed
        if selected is None:
            continue
        approved = selected.activated_at is not None or selected.imported
        starts = selected.scheduled_from or selected.effective_from
        state = ('scheduled' if starts > on_date else 'current') if approved else 'requested'
        reference = max(on_date, starts)
        covered = 0
        for slot in selected.care_slots:
            next_day = reference + timedelta(days=(weekdays[slot.day_of_week] - reference.weekday()) % 7)
            # A queued revision can end this plan before that weekday recurs.
            # Show its coverage at the transition, rather than inventing a gap
            # for a visit that this version will never require.
            if selected.ends_on is not None:
                next_day = min(next_day, selected.ends_on)
            if approved and any(
                a.starts_on <= next_day and (a.ends_before is None or next_day < a.ends_before)
                for a in by_slot[slot.id]
            ):
                covered += 1
        def minutes(value):
            return value.hour * 60 + value.minute + value.second / 60
        result[client_id] = {
            'weekly_hours': round(sum(minutes(s.end_time) - minutes(s.start_time) for s in selected.care_slots) / 60, 2),
            'slot_count': len(selected.care_slots),
            'covered_slot_count': None if selected.imported else covered,
            'state': state,
            'starts_on': starts if state != 'current' else None,
            'revision_pending': proposed is not None and proposed.id != selected.id,
            'scheduled_change_on': (future[0].scheduled_from or future[0].effective_from) if client_id in current and future else None,
        }
    return result
