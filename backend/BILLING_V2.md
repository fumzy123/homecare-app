# Billing version 2 — September 29, 2026

This supersedes older pricing and onboarding timing in the billing design notes.

## Commercial rules

- Standard monthly: CAD 350 base, 10 active clients included per billing month,
  CAD 5 for each additional client.
- Standard annual: CAD 3,360 prepaid base; the same monthly allowance and CAD 5
  additional-client rate. The 20% saving applies to base only.
- Founding: CAD 200 + CAD 4 above 10, monthly only, first 12 paid months.
- Verified agency creation starts the automatic 14-day application trial. No
  onboarding approval, operator button, or training milestone controls purchase.
- An owner chooses a plan and authorizes payment before subscription creation.
  Remaining trial time is preserved. An expired trial purchases immediately;
  no retrospective charges are created for trial or unsubscribed days.

## Counting and settlement

Counting uses actual recurring occurrences and their modifications, scoped to
the organization and billing window. It short-circuits once a client qualifies.
It never equates a client registry status with billable usage. Cancelled-only
clients are excluded; no-shows count. Existing completed occurrences survive
series cancellation. There is no scheduling capacity cap.

Each monthly anniversary window remains correctable for 72 hours after its end.
Then its immutable snapshot is used for billing. Operational edits remain allowed;
late financial corrections use the existing approval/audit mechanism.

For annual version 2, each original settlement stays `accrued`. After all twelve
snapshots exist and the final 72-hour window closes, one durable annual settlement
freezes the monthly amounts and approved adjustments. It adds monthly usage lines
to the held Stripe renewal draft, validates every line, finalizes and collects it.
The subscription anniversary and access are unchanged by the collection hold.

Cancellation means cancel renewal at the end of prepaid coverage. A final usage-only
invoice is collected after the same correction window; no next-year base is charged.
Missing renewal holds fail for review instead of silently generating a second bill.
Retries use durable leases, persisted steps, fixed Stripe idempotency keys and
remote metadata recovery. Original monthly records are linked to their annual
invoice lines so later credit notes affect usage, not the prepaid base.

## Customer interface

Billing shows active/included/additional clients, this period's additional charge,
finalized annual balance and estimated usage to add to the next invoice. It clearly
excludes base and tax. Unconfirmed history suppresses misleading aggregate totals.
Trial counts are visible with no charges. Cancelled accounts retain their pending
usage display. Invoice history has no permanent Amount due column; cancellation
uses red styling. Rectangular panels follow the existing Settings design.

Annual in-app notifications are deduplicated at 30, 7 and 1 days before the annual
coverage boundary, showing the expected collection date three days later and
finalized usage so far. They link to Billing. Email reminders are not implemented.

## Configuration and rollout

Use `STRIPE_STANDARD_MONTHLY_V2_PRICE_ID` and `STRIPE_STANDARD_ANNUAL_V2_PRICE_ID`.
The sandbox provisioning script creates/verifies CAD 350 and CAD 3,360 test prices.
Historical version 1 price settings remain for already-recorded agreements.

Apply Alembic revision `c6a1d9e2f803` (annual reminder enum). It does not rewrite
accounts or delete data; downgrade deliberately retains the enum label.

Runtime switches: `BILLING_ONBOARDING_ENABLED` (historically named purchase-flow
switch), `BILLING_USAGE_FINALIZATION_ENABLED`, `BILLING_SETTLEMENT_ENABLED`, and
`BILLING_NOTIFICATIONS_ENABLED`. Live settlement has a separate switch and stays off
for local development. Set usage tax mode explicitly: `none` for untaxed test mode,
or `stripe` with a configured usage tax code. No production tax configuration is
assumed. Recreate the Compose backend when changing environment variables.

Stripe webhooks must reach the backend, notably `invoice.created`, so renewal
invoices are held before automatic finalization. The settlement job recovers missed
drafts, but is not a substitute for reliable webhook delivery. Keep one scheduler
process until the repository's documented horizontal-scaling work is completed.

## Verification

- Backend regression tests cover trial access, counting, snapshots/cutoffs,
  adjustments, settlement leases, retries, annual grouping and reminders.
- Frontend TypeScript, lint and server-render checks cover pricing, trial purchase,
  usage summaries, invoice history and owner actions. These are not browser tests.
- `scripts/verify_embedded_billing_sandbox.py` uses disposable Stripe test customers
  for embedded setup, trial-preserving plan changes and paid renewal changes.
- `scripts/verify_annual_billing_sandbox.py` uses isolated application records and
  disposable real Stripe test clocks for annual renewal and end-of-year cancellation.

Before public launch: production Stripe prices/webhook configuration, business tax
settings, and the existing draft legal documents still need release configuration
and review. These local changes do not publish or enable live collections.
