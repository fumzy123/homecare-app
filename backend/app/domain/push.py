"""Allowlisted, patient-free lock-screen content. Never serialize inbox payloads."""
CONTENT = {
    'shift_assigned': ('New visit assignment', 'Your agency assigned you care. Open your schedule to review.'),
    'placement_filled': ('New care assignment', 'Your care request has been approved. Open the app to review.'),
    'shift_updated': ('Schedule updated', 'Your agency changed your schedule. Open the app to review.'),
    'shift_cancelled': ('Schedule cancellation', 'Care has been removed from your schedule. Open the app to review.'),
}


def push_message(delivery):
    title, body = CONTENT[delivery.kind]
    return {'to': delivery.token, 'title': title, 'body': body,
            'sound': 'default', 'channelId': 'default', 'ttl': 3600,
            'data': {'notification_id': str(delivery.notification_id)},
            'collapseId': str(delivery.notification_id)}


def schedule_snapshot(shift):
    return tuple(getattr(shift, field, None) for field in (
        'worker_id', 'client_id', 'start_time', 'end_time', 'service_type',
        'is_recurring', 'recurrence_rule', 'recurrence_end_date', 'location', 'notes'))


def modification_snapshot(mod):
    if mod is None:
        return (None, None, None, False)
    return (mod.new_start_time, mod.new_end_time, getattr(mod, 'notes', None),
            getattr(mod, 'completion_status', None) == 'cancelled')
