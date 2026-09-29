"""Stripe adapter for usage settlement. Never receives client/care information."""
from datetime import datetime
import stripe
from app.core.config import settings
from app.core.stripe_objects import stripe_field as field
from app.services.billing_settlement_service import SettlementReviewRequired, settlement_enabled


def remote_id(value):
    return value if isinstance(value, str) else field(value, "id")


class StripeUsageGateway:
    def __init__(self, service, operation, token):
        self.service, self.op, self.token = service, operation, token
        self.context = operation["context"]
        self.customer = self.context["customer"]
        self.marker = str(operation["id"])

    def _check(self, obj):
        if field(obj, "livemode", False) and not settings.billing_settlement_live_enabled:
            raise SettlementReviewRequired("LIVE_SETTLEMENT_DISABLED")
        if remote_id(field(obj, "customer")) != self.customer:
            raise SettlementReviewRequired("STRIPE_CUSTOMER_MISMATCH")
        if field(obj, "currency", "cad") != "cad":
            raise SettlementReviewRequired("STRIPE_CURRENCY_MISMATCH")
        return obj

    def _unique(self, values, step):
        matches = [self._check(v) for v in values if field(field(v, "metadata", {}), "care_harbor_step") == step
                   and field(field(v, "metadata", {}), "care_harbor_settlement") == self.marker]
        if len(matches) > 1:
            raise SettlementReviewRequired("DUPLICATE_STRIPE_OBJECTS")
        return matches[0].id if matches else None

    def _metadata(self, step):
        return dict(care_harbor_settlement=self.marker, care_harbor_step=step,
                    care_harbor_period=str(self.op["period_id"]))

    def _step(self, name, params, recover, send, creation=True):
        return self.service.step(self.op["id"], self.token, name, params, recover, send, creation=creation)

    def _tax(self, invoice=None):
        mode = settings.billing_usage_tax_mode
        if mode not in ("none", "stripe"):
            raise SettlementReviewRequired("USAGE_TAX_CONFIGURATION_REQUIRED")
        if mode == "stripe" and not settings.stripe_usage_tax_code:
            raise SettlementReviewRequired("USAGE_TAX_CODE_REQUIRED")
        if invoice is not None:
            enabled = field(field(invoice, "automatic_tax", {}), "enabled", False)
            if enabled != (mode == "stripe") or field(invoice, "default_tax_rates", []):
                raise SettlementReviewRequired("INVOICE_TAX_SETTINGS_MISMATCH")
        return mode == "stripe"

    def run(self):
        if not settlement_enabled():
            raise SettlementReviewRequired("SETTLEMENT_DISABLED")
        # Validate the customer mode before sending any mutation, not just responses.
        customer = stripe.Customer.retrieve(self.customer)
        if field(customer, "livemode", False) and not settings.billing_settlement_live_enabled:
            raise SettlementReviewRequired("LIVE_SETTLEMENT_DISABLED")
        if field(customer, "deleted", False):
            raise SettlementReviewRequired("CUSTOMER_DELETED")
        if self.op["amount_cents"] < 0:
            return self._credit()
        if self.context.get("annual_entries"):
            return self._annual_charge()
        return self._charge()

    def _annual_charge(self):
        if self.op["invoice_id"]:
            invoice = self._check(stripe.Invoice.retrieve(self.op["invoice_id"]))
            if invoice.status not in ("open", "paid"):
                raise SettlementReviewRequired("ISSUED_INVOICE_CHANGED")
            return dict(state="invoiced", invoice_id=invoice.id, payment_status=invoice.status)
        hold = self.service.settlement_repo.hold(self.op["org_id"], self.context["subscription"],
                                                 datetime.fromisoformat(self.context["starts_at"]))
        held_id = hold.invoice_id if hold and hold.state in ("held", "released") else None
        expected_base = (hold.base_line_id, hold.base_amount_cents) if held_id else None
        self.service.db.commit()
        if held_id:
            invoice = self._check(stripe.Invoice.retrieve(held_id))
            if field(field(invoice, "metadata", {}), "care_harbor_usage_start") != self.context["starts_at"]:
                raise SettlementReviewRequired("ANNUAL_HOLD_CHANGED")
        else:
            sub = self._check(stripe.Subscription.retrieve(self.context["subscription"]))
            # Missing a renewal hold must not silently create a second renewal bill.
            if sub.status != "canceled" or field(sub, "ended_at") != int(datetime.fromisoformat(self.context["annual_end"]).timestamp()):
                raise SettlementReviewRequired("ANNUAL_RENEWAL_HOLD_REQUIRED")
            if self.op["amount_cents"] == 0:
                return dict(state="zero", payment_status="not_required")
            params = dict(customer=self.customer, currency="cad", collection_method="charge_automatically",
                auto_advance=False, pending_invoice_items_behavior="exclude", discounts=[],
                automatic_tax={"enabled": self._tax()}, metadata=self._metadata("invoice"),
                description="Care Harbor final annual additional-client usage")
            invoice_id = self._step("invoice", params,
                lambda _: self._unique(stripe.Invoice.list(customer=self.customer, limit=100).auto_paging_iter(), "invoice"),
                lambda p, key: stripe.Invoice.create(**p, idempotency_key=key).id)
            invoice = self._check(stripe.Invoice.retrieve(invoice_id))
        self._tax(invoice)
        allowed = set()
        for entry in self.context["annual_entries"]:
            if entry["amount"] == 0:
                continue
            if entry["amount"] < 0 or entry["amount"] % entry["rate"]:
                raise SettlementReviewRequired("INVALID_ANNUAL_USAGE")
            name = f"item-{entry['period_id']}"
            quantity = entry["amount"] // entry["rate"]
            params = dict(customer=self.customer, invoice=invoice.id, currency="cad", quantity=quantity,
                unit_amount_decimal=str(entry["rate"]), discountable=False, tax_behavior="exclusive",
                description=f"Additional clients · {entry['starts_at'][:10]} to {entry['ends_at'][:10]}",
                period=dict(start=int(datetime.fromisoformat(entry["starts_at"]).timestamp()),
                            end=int(datetime.fromisoformat(entry["ends_at"]).timestamp())), metadata=self._metadata(name))
            if settings.billing_usage_tax_mode == "stripe":
                params["tax_code"] = settings.stripe_usage_tax_code
            item_id = self._step(name, params,
                lambda _, step=name: self._unique(stripe.InvoiceItem.list(customer=self.customer, limit=100).auto_paging_iter(), step),
                lambda p, key: stripe.InvoiceItem.create(**p, idempotency_key=key).id)
            item = self._check(stripe.InvoiceItem.retrieve(item_id))
            if remote_id(field(item, "invoice")) != invoice.id or item.amount != entry["amount"]:
                raise SettlementReviewRequired("ANNUAL_ITEM_CHANGED")
            lines = list(stripe.Invoice.list_lines(invoice.id, limit=100).auto_paging_iter())
            own = [line for line in lines if (field(field(field(line, "parent", {}), "invoice_item_details", {}), "invoice_item")
                    or remote_id(field(line, "invoice_item"))) == item_id]
            if len(own) != 1 or own[0].amount != entry["amount"]:
                raise SettlementReviewRequired("ANNUAL_LINE_MISMATCH")
            line_id = own[0].id
            self._step(f"line-{entry['period_id']}", {"line": line_id}, lambda p: p["line"], lambda p, _: p["line"])
            allowed.add(line_id)
        lines = list(stripe.Invoice.list_lines(invoice.id, limit=100).auto_paging_iter())
        if expected_base:
            allowed.add(expected_base[0])
            if not any(line.id == expected_base[0] and line.amount == expected_base[1] for line in lines):
                raise SettlementReviewRequired("ANNUAL_BASE_CHANGED")
        if {line.id for line in lines} != allowed:
            raise SettlementReviewRequired("UNEXPECTED_ANNUAL_INVOICE_ITEMS")
        self._step("finalize", {"invoice": invoice.id},
            lambda p: p["invoice"] if stripe.Invoice.retrieve(p["invoice"]).status in ("open", "paid") else None,
            lambda p, key: stripe.Invoice.finalize_invoice(p["invoice"], auto_advance=True, idempotency_key=key).id, creation=False)
        invoice = self._check(stripe.Invoice.retrieve(invoice.id))
        if invoice.status == "open":
            try:
                self._step("pay", {"invoice": invoice.id},
                    lambda p: p["invoice"] if stripe.Invoice.retrieve(p["invoice"]).status == "paid" else None,
                    lambda p, key: stripe.Invoice.pay(p["invoice"], idempotency_key=key).id, creation=False)
            except stripe.CardError:
                pass
            invoice = self._check(stripe.Invoice.retrieve(invoice.id))
        if invoice.status not in ("open", "paid"):
            raise SettlementReviewRequired("ANNUAL_INVOICE_NOT_COLLECTIBLE")
        return dict(state="invoiced", invoice_id=invoice.id, payment_status=invoice.status)

    def _charge(self):
        if self.op["invoice_id"]:
            invoice = self._check(stripe.Invoice.retrieve(self.op["invoice_id"]))
            if invoice.status not in ("open", "paid"):
                raise SettlementReviewRequired("ISSUED_INVOICE_CHANGED")
            return dict(state="invoiced", invoice_id=invoice.id, line_id=self.op["invoice_line_id"], payment_status=invoice.status)
        invoice = None
        expected_base = None
        if not self.op["adjustment_id"] and self.context["interval"] == "month":
            hold = self.service.settlement_repo.hold(self.op["org_id"], self.context["subscription"],
                                                     datetime.fromisoformat(self.context["starts_at"]))
            held_id = hold.invoice_id if hold and hold.state in ("held", "released") else None
            expected_base = (hold.base_line_id, hold.base_amount_cents) if held_id else None
            self.service.db.commit()
            if held_id:
                candidate = self._check(stripe.Invoice.retrieve(held_id))
                if field(field(candidate, "metadata", {}), "care_harbor_usage_start") != self.context["starts_at"]:
                    raise SettlementReviewRequired("INVOICE_HOLD_OWNERSHIP_CHANGED")
                # If it finalized without our usage, keep the base payment and issue
                # separate usage. If our item was already attached, reuse that invoice.
                items = list(stripe.InvoiceItem.list(customer=self.customer, limit=100).auto_paging_iter())
                own_item = any(remote_id(field(i, "invoice")) == candidate.id
                               and field(field(i, "metadata", {}), "care_harbor_settlement") == self.marker for i in items)
                if candidate.status == "draft" or own_item or self.op["amount_cents"] == 0:
                    invoice = candidate
        if invoice is None and self.op["amount_cents"] == 0:
            return dict(state="zero", payment_status="not_required")
        if invoice is None:
            expected_base = None
            sub = stripe.Subscription.retrieve(self.context["subscription"])
            if remote_id(sub.customer) != self.customer:
                raise SettlementReviewRequired("SUBSCRIPTION_CUSTOMER_MISMATCH")
            params = dict(customer=self.customer, currency="cad", collection_method="charge_automatically",
                auto_advance=False, pending_invoice_items_behavior="exclude", discounts=[],
                automatic_tax={"enabled": self._tax()}, metadata=self._metadata("invoice"),
                description="Care Harbor additional active-client usage")
            invoice_id = self._step("invoice", params,
                lambda _: self._unique(stripe.Invoice.list(customer=self.customer, limit=100).auto_paging_iter(), "invoice"),
                lambda p, key: stripe.Invoice.create(**p, idempotency_key=key).id)
            invoice = self._check(stripe.Invoice.retrieve(invoice_id))
        self._tax(invoice)
        line_id = None
        if self.op["amount_cents"]:
            amount, rate = self.op["amount_cents"], self.context["rate"]
            if amount % rate:
                raise SettlementReviewRequired("NONINTEGRAL_CLIENT_QUANTITY")
            quantity = amount // rate
            params = dict(customer=self.customer, invoice=invoice.id, currency="cad", quantity=quantity,
                unit_amount_decimal=str(rate), discountable=False, tax_behavior="exclusive",
                description=f"{quantity} additional active clients at CAD {rate / 100:.2f} each",
                period=dict(start=int(datetime.fromisoformat(self.context["starts_at"]).timestamp()),
                            end=int(datetime.fromisoformat(self.context["ends_at"]).timestamp())), metadata=self._metadata("item"))
            if settings.billing_usage_tax_mode == "stripe":
                params["tax_code"] = settings.stripe_usage_tax_code
            item_id = self._step("item", params,
                lambda _: self._unique(stripe.InvoiceItem.list(customer=self.customer, limit=100).auto_paging_iter(), "item"),
                lambda p, key: stripe.InvoiceItem.create(**p, idempotency_key=key).id)
            item = self._check(stripe.InvoiceItem.retrieve(item_id))
            if remote_id(field(item, "invoice")) != invoice.id or item.amount != amount or item.quantity != quantity:
                raise SettlementReviewRequired("USAGE_ITEM_CHANGED")
            lines = list(stripe.Invoice.list_lines(invoice.id, limit=100).auto_paging_iter())
            own = [line for line in lines if (field(field(field(line, "parent", {}), "invoice_item_details", {}), "invoice_item")
                                             or remote_id(field(line, "invoice_item"))) == item_id]
            if len(own) != 1 or own[0].amount != amount:
                raise SettlementReviewRequired("USAGE_LINE_MISMATCH")
            line_id = own[0].id
        all_lines = list(stripe.Invoice.list_lines(invoice.id, limit=100).auto_paging_iter())
        allowed = {line_id} if line_id else set()
        if expected_base:
            allowed.add(expected_base[0])
            bases = [line for line in all_lines if line.id == expected_base[0]]
            if len(bases) != 1 or bases[0].amount != expected_base[1]:
                raise SettlementReviewRequired("RENEWAL_BASE_CHANGED")
        if {line.id for line in all_lines} != allowed:
            raise SettlementReviewRequired("UNEXPECTED_INVOICE_ITEMS")
        # Finalize only after attaching and checking usage. Auto-advance restores
        # Stripe's collection/dunning; explicit pay exercises immediate collection.
        self._step("finalize", {"invoice": invoice.id},
            lambda p: p["invoice"] if stripe.Invoice.retrieve(p["invoice"]).status in ("open", "paid") else None,
            lambda p, key: stripe.Invoice.finalize_invoice(p["invoice"], auto_advance=True, idempotency_key=key).id, creation=False)
        invoice = self._check(stripe.Invoice.retrieve(invoice.id))
        if invoice.status == "open":
            try:
                self._step("pay", {"invoice": invoice.id},
                    lambda p: p["invoice"] if stripe.Invoice.retrieve(p["invoice"]).status == "paid" else None,
                    lambda p, key: stripe.Invoice.pay(p["invoice"], idempotency_key=key).id, creation=False)
            except stripe.CardError:
                pass  # Preserve the open invoice; never create another to retry payment.
            invoice = self._check(stripe.Invoice.retrieve(invoice.id))
        if invoice.status not in ("open", "paid"):
            raise SettlementReviewRequired("INVOICE_NOT_COLLECTIBLE")
        return dict(state="invoiced", invoice_id=invoice.id, line_id=line_id, payment_status=invoice.status)

    def _credit(self):
        pending = False
        for index, allocation in enumerate(self.context["credits"]):
            invoice = self._check(stripe.Invoice.retrieve(allocation["invoice"]))
            if invoice.status not in ("open", "paid"):
                raise SettlementReviewRequired("CREDIT_INVOICE_NOT_COLLECTIBLE")
            step = f"credit-{index}"
            lines = [dict(type="invoice_line_item", invoice_line_item=allocation["line"], amount=allocation["amount"])]
            # Reconcile before preview: an already-issued credit can reduce what's
            # previewable, so previewing first would make successful retries fail.
            recovered = self._unique(stripe.CreditNote.list(invoice=invoice.id, limit=100).auto_paging_iter(), step)
            params = dict(invoice=invoice.id, lines=lines, reason="order_change", email_type="none", metadata=self._metadata(step))
            if recovered is None:
                preview = stripe.CreditNote.preview(invoice=invoice.id, lines=lines)
                params["refund_amount"] = preview.post_payment_amount
            credit_id = self._step(step, params,
                lambda p: self._unique(stripe.CreditNote.list(invoice=p["invoice"], limit=100).auto_paging_iter(), step),
                lambda p, key: stripe.CreditNote.create(**p, idempotency_key=key).id)
            credit = self._check(stripe.CreditNote.retrieve(credit_id))
            if credit.status != "issued" or remote_id(credit.invoice) != invoice.id:
                raise SettlementReviewRequired("CREDIT_NOTE_CHANGED")
            for refund in field(credit, "refunds", []):
                result = stripe.Refund.retrieve(remote_id(field(refund, "refund")))
                if result.status in ("failed", "canceled"):
                    raise SettlementReviewRequired("REFUND_FAILED")
                pending = pending or result.status != "succeeded"
        return dict(state="credited", payment_status="refund_pending" if pending else "credited")
