"""Validate invoice coverage without guessing historical subscription terms."""
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
from app.core.stripe_objects import stripe_field as field
from app.domain.billing import get_plan
from app.domain.billing_periods import monthly_usage_window


def instant(value):
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError("Missing Stripe coverage timestamp")
    return datetime.fromtimestamp(value, timezone.utc)


def invoice_periods(context, subscription, invoices, now):
    """Return verified full monthly windows; partial cancellation needs review."""
    if field(subscription, "id") != context["subscription_id"] or field(subscription, "customer") != context["customer_id"]:
        raise ValueError("Subscription ownership mismatch")
    if field(subscription, "trial_end") != int(context["anchor"].timestamp()):
        raise ValueError("Paid anchor differs from Stripe")
    ended = field(subscription, "ended_at")
    if field(subscription, "status") == "canceled" and not ended:
        raise ValueError("Cancellation coverage is unknown")
    ended = instant(ended) if ended else None
    output, partial = {}, False
    for invoice, lines in invoices:
        if field(invoice, "customer") != context["customer_id"]:
            raise ValueError("Invoice ownership mismatch")
        parent_sub = field(field(field(invoice, "parent", {}), "subscription_details", {}), "subscription")
        if (parent_sub or field(invoice, "subscription")) != context["subscription_id"]:
            raise ValueError("Invoice subscription mismatch")
        if field(invoice, "status") == "draft":
            continue
        if field(invoice, "status") not in ("paid", "open"):
            raise ValueError("Voided/uncollectible coverage needs review")
        if (field(invoice, "post_payment_credit_notes_amount", 0) or field(invoice, "pre_payment_credit_notes_amount", 0)) and field(invoice, "id") not in context.get("verified_usage_credit_invoices", set()):
            raise ValueError("Credited invoice coverage needs review")
        for line in lines:
            parent = field(line, "parent", {})
            details = field(parent, "subscription_item_details", {})
            if field(parent, "type") != "subscription_item_details" and field(line, "type") != "subscription":
                continue  # One-off invoices/items never establish base coverage.
            if field(details, "subscription", field(line, "subscription")) != context["subscription_id"]:
                raise ValueError("Invoice line subscription mismatch")
            start = instant(field(field(line, "period", {}), "start"))
            end = instant(field(field(line, "period", {}), "end"))
            if end <= context["anchor"]:
                continue  # The free trial is never a paid usage window.
            if field(details, "proration", field(line, "proration", False)):
                raise ValueError("Prorated coverage needs review")
            code, version, price = context["plan_code"], context["plan_version"], context["price_id"]
            conversion = context.get("conversion")
            if conversion and start < conversion["effective_at"] < end:
                raise ValueError("Coverage crosses a founding price change")
            if conversion and start >= conversion["effective_at"]:
                code, version, price = "standard", conversion["version"], conversion["price_id"]
            plan = get_plan(code, context["interval"], version=version)
            line_price = field(field(field(line, "pricing", {}), "price_details", {}), "price")
            line_price = line_price or field(field(line, "price", {}), "id")
            if (line_price != price or field(line, "quantity") != 1 or field(line, "currency") != plan.currency
                    or field(line, "amount") != plan.base_amount_cents):
                raise ValueError("Invoice line differs from agreed pricing")
            if start < context["anchor"] or monthly_usage_window(context["anchor"], start)[0] != start:
                raise ValueError("Coverage differs from original monthly anchor")
            month = (start.year - context["anchor"].year) * 12 + start.month - context["anchor"].month
            duration = 12 if context["interval"] == "year" else 1
            if duration == 12 and month % 12:
                raise ValueError("Annual coverage starts outside the paid anniversary")
            if context["anchor"] + relativedelta(months=month + duration) != end:
                raise ValueError("Incomplete base coverage")
            for offset in range(duration):
                a = context["anchor"] + relativedelta(months=month + offset)
                b = context["anchor"] + relativedelta(months=month + offset + 1)
                if a > now or (ended and a >= ended):
                    continue
                if ended and b > ended:
                    partial = True
                    continue
                if a in output:
                    raise ValueError("Overlapping invoice coverage")
                output[a] = (b, plan, field(invoice, "id"), field(line, "id"))
    months = (now.year - context["anchor"].year) * 12 + now.month - context["anchor"].month
    for offset in range(max(0, months + 1)):
        start = context["anchor"] + relativedelta(months=offset)
        end = context["anchor"] + relativedelta(months=offset + 1)
        if end > now or (ended and end > ended):
            continue
        if start not in output:
            raise ValueError("Missing subscription invoice coverage")
    return output, partial
