"""Freeze twelve finalized monthly ledgers into one durable annual collection."""
from datetime import datetime, timedelta, timezone
import stripe
from app.services.billing_cutoff_service import utc
from app.services.billing_settlement_service import BillingSettlementService, SettlementReviewRequired


class BillingAnnualService(BillingSettlementService):
    def prepare_year(self, org_id, invoice_id, line_id, *, now=None):
        now = now or datetime.now(timezone.utc)
        if self.settlement_repo.by_source(f"annual:{invoice_id}:{line_id}"):
            self.db.commit()
            return
        # Verify the actual purchased annual coverage, including interval switches.
        invoice = stripe.Invoice.retrieve(invoice_id)
        lines = list(stripe.Invoice.list_lines(invoice_id, limit=100).auto_paging_iter())
        line = next((line for line in lines if line.id == line_id), None)
        if line is None or invoice.status not in ("paid", "open"):
            raise SettlementReviewRequired("ANNUAL_COVERAGE_REVIEW")
        start = datetime.fromtimestamp(line.period.start, timezone.utc)
        end = datetime.fromtimestamp(line.period.end, timezone.utc)
        if now < end + timedelta(hours=72):
            return
        try:
            org = self.cutoff_repo.lock_organization(org_id)
            if not org or org.stripe_customer_id != invoice.customer:
                raise SettlementReviewRequired("ANNUAL_CUSTOMER_MISMATCH")
            key = f"annual:{invoice_id}:{line_id}"
            if self.settlement_repo.by_source(key):
                self.db.commit()
                return
            rows = self.settlement_repo.annual_periods(org_id, invoice_id, line_id)
            if len(rows) != 12 or any(snapshot is None for _, snapshot in rows):
                self.db.commit()
                return  # Recovery/finalization must finish all twelve months first.
            cursor, entries = start, []
            for period, snapshot in rows:
                if utc(period.starts_at) != cursor or period.base_interval != "year" or period.plan_version not in (2, 3):
                    raise SettlementReviewRequired("ANNUAL_PERIOD_MISMATCH")
                cursor = utc(period.ends_at)
                source = self.settlement_repo.by_source(f"usage:{period.id}")
                if source is None:
                    self.db.commit()
                    return
                if source.state != "accrued":
                    raise SettlementReviewRequired("ANNUAL_USAGE_ALREADY_SUBMITTED")
                adjustments = self.settlement_repo.approved_adjustments(org_id, period.id)
                amount = snapshot.usage_amount_cents + sum(a.amount_cents for a in adjustments)
                if amount < 0:
                    raise SettlementReviewRequired("ANNUAL_NEGATIVE_USAGE")
                entries.append(dict(source_key=source.source_key, period_id=str(period.id), amount=amount,
                    rate=period.additional_client_amount_cents, starts_at=utc(period.starts_at).isoformat(),
                    ends_at=cursor.isoformat(), adjustments=[str(a.id) for a in adjustments]))
            if cursor != end:
                raise SettlementReviewRequired("ANNUAL_COVERAGE_GAP")
            period, snapshot = rows[-1]
            group = self._new(org, period.id, key, sum(e["amount"] for e in entries), snapshot.payload["period"], None)
            group.context = {**group.context, "annual_entries": entries, "annual_start": start.isoformat(),
                             "annual_end": end.isoformat()}
            self.settlement_repo.add(group)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
