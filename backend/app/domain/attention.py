"""Pure action lifecycle projection. Reading an action never resolves it."""
from datetime import timedelta
from app.schemas.attention import AttentionItem, AttentionTarget


def coverage_item(need, client, placement, covered, today):
    if need.imported or (need.ends_on and need.ends_on < today):
        return None
    remaining = {str(slot.id) for slot in need.care_slots if slot.id not in covered}
    if not remaining:
        return None
    pending = sum(bool(remaining.intersection(interest.care_slot_ids or [])) for interest in placement.interests) if placement else 0
    due = need.scheduled_from or need.effective_from
    overdue = due <= today
    if not placement or placement.status.value == 'closed':
        stage, detail = 'post_placement', 'Weekly Care Need ready to post'
    elif pending:
        stage, detail = 'review_interest', f'{pending} interested workers · {len(remaining)} open Care Slots'
    elif overdue or covered:
        stage, detail = 'cover_slots', f'{len(remaining)} Care Slots still uncovered'
    else:
        stage, detail = 'await_interest', f'{len(remaining)} open Care Slots · Awaiting worker interest'
    return AttentionItem(
        id=f'care:{need.id}', category='coverage', stage=stage,
        urgency='urgent' if overdue else 'upcoming' if due <= today + timedelta(days=7) else 'waiting' if stage == 'await_interest' else 'review',
        subject=f'{client.first_name} {client.last_name}', detail=detail, due_on=due,
        target=AttentionTarget(kind='care_need' if stage == 'post_placement' else 'placement',
            record_id=need.client_id if stage == 'post_placement' else placement.id, detail_id=need.id),
    )


def sort_items(items):
    order = {'urgent': 0, 'upcoming': 1, 'review': 2, 'waiting': 3}
    return sorted(items, key=lambda i: (order[i.urgency], i.due_on.isoformat() if i.due_on else '9999', i.subject, i.id))
