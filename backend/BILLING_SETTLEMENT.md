# Usage invoices and approved corrections

This extends BILLING_ONBOARDING.md. Settlement is implemented but disabled.

## Rollout

- Migration `a4e8f2b9c731` adds settlement operations and monthly invoice holds.
  Apply before deploying the new recovery queries. Development verification
  generated SQL offline; no shared database migration was applied.
- `BILLING_SETTLEMENT_ENABLED` defaults to false and requires onboarding rollout.
  `BILLING_SETTLEMENT_LIVE_ENABLED` independently defaults to false.
- `BILLING_USAGE_TAX_MODE` must explicitly be `none` or `stripe`. The latter
  requires `STRIPE_USAGE_TAX_CODE` and matching invoice tax settings. Configure
  tax treatment before rollout; CAD alone does not determine tax treatment.

## Workflow

- Signed `invoice.created` events hold eligible monthly renewal drafts. The
  15-minute worker also scans missed draft events. After the previous usage
  window is finalized, it attaches usage and collects the combined renewal.
  Initial trial conversion is not held. If a renewal already finalized without
  usage, a separate usage invoice is issued instead.
- Annual plans receive separate monthly usage invoices; zero usage creates no
  separate invoice. Cancellation does not discard already-finalized usage.
- Original usage and approved adjustments each have a unique durable operation.
  Corrections run in approval order. Negative amounts credit original usage
  lines: unpaid debt is reduced; paid amounts are refunded using credit notes.
  Pending/failed refunds remain visible and do not create a second credit.
- Parameters and deterministic Stripe keys are recorded before each request.
  A lease serializes workers; metadata reconciles ambiguous remote success.
  After 23 hours, an unresolvable creation attempt needs review rather than a
  new charge. Open invoices are monitored while Stripe handles payment retries.
- Remote calls happen outside database locks. Unexpected ownership, invoice
  lines, changed terms, or invalid requests stop the operation for review.
  Only counts, rates, and opaque billing references are sent to Stripe.
- `GET /billing/usage/periods/{period_id}/settlements` returns organization-scoped
  amounts and settlement/payment states. Customer history and operator review
  screens remain pending; this step implements the backend workflow.

## Verification

`scripts/verify_usage_settlement_sandbox.py` uses actual settlement services,
disposable Stripe test clocks and an in-memory database. It verified a CAD 400
combined monthly invoice, CAD 100 annual-plan usage invoice, CAD 5 refunds,
and duplicate-operation replays. It rejects live keys and deletes test clocks.

Unit tests also cover leases, frozen retry arguments, expired ambiguous attempts,
live-mode rejection, zero usage, open invoices, adjustment preparation, unpaid
credits and pending/failed refunds. PostgreSQL concurrency, deployed webhook
delivery, automatic tax, payment authentication/dunning, and customer-facing
recovery remain staging checks. Production flags remain disabled.
