"""Presentation and identity of retained updates; never decides workflow completion."""

from app.core.enums import NotificationType


def notification_key(kind, payload, worker_id, notification_id):
    kind = getattr(kind, "value", kind)
    if kind == "credential_uploaded":
        return f"credential:{worker_id}:{payload.get('document_type')}"
    if kind == "shift_dropped":
        return f"visit:{payload.get('shift_id')}:{payload.get('occurrence_date')}"
    if kind == "profile_updated":
        return f"worker:{worker_id}"
    if kind == "placement_interest_received":
        return f"placement:{payload.get('placement_id')}"
    if kind == "billing_payment_failed":
        return f"invoice:{payload.get('invoice_id')}"
    return f"notice:{notification_id}"


def _notification_content(notice):
    p = notice.payload or {}
    kind = notice.type.value
    worker = notice.about_worker
    name = (
        f"{worker.person.first_name} {worker.person.last_name}" if worker else "Worker"
    )
    worker_target = (
        {"kind": "worker", "record_id": str(notice.about_worker_id)}
        if notice.about_worker_id
        else None
    )
    if kind == "credential_uploaded":
        return (
            "credentials",
            f"{name} uploaded a document",
            str(p.get("document_type", "")).replace("_", " "),
            {
                "kind": "credential",
                "record_id": str(notice.about_worker_id),
                "document_type": p.get("document_type"),
            },
        )
    if kind == "profile_updated":
        return (
            "workers",
            f"{name} updated their profile",
            ", ".join(str(f).replace("_", " ") for f in p.get("changed_fields", [])),
            worker_target,
        )
    if kind == "shift_dropped":
        return (
            "schedule",
            f"{name} dropped a visit",
            str(p.get("client_name", "")),
            {
                "kind": "visit",
                "record_id": p.get("shift_id"),
                "occurrence_date": p.get("occurrence_date"),
            },
        )
    if kind == "placement_interest_received":
        return (
            "coverage",
            f"{name} expressed interest",
            "Review the requested care slots",
            {"kind": "placement", "record_id": p.get("placement_id")},
        )
    if kind == "overtime_approval_requested":
        return (
            "schedule",
            f"Overtime requested for {name}",
            str(p.get("client_name") or ""),
            {"kind": "overtime", "record_id": str(notice.id)},
        )
    billing = {
        NotificationType.billing_payment_failed.value: "Payment needs attention"
        if not notice.resolved_at
        else "Payment alert resolved",
        NotificationType.billing_trial_reminder.value: "Trial ending soon",
        NotificationType.billing_annual_reminder.value: "Upcoming annual billing",
        NotificationType.founding_conversion_notice.value: "Upcoming pricing change",
    }
    if kind in billing:
        return (
            "billing",
            billing[kind],
            "Review your subscription and billing details",
            {"kind": "billing", "record_id": str(notice.org_id)},
        )
    return "workers", "Agency update", "", worker_target


def notification_content(notice):
    from pydantic import ValidationError
    from app.schemas.attention import AttentionTarget

    category, title, detail, target = _notification_content(notice)
    # Retain readable legacy history even when an old event lacks a valid link.
    if target:
        try:
            AttentionTarget.model_validate(target)
        except ValidationError:
            target = None
    return category, title, detail, target
