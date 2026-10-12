"""Read-only projection of the care requirement effective on a given date."""


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
