# Usage invoices and approved corrections

This extends BILLING_ONBOARDING.md. Settlement is implemented but disabled.

## Durable Stripe messages and billing notices

- Apply migration `b5f9a3c0d842` before deploying this code, including before
  starting the scheduler. It adds backend-only, RLS-protected webhook receipts
  and notice deduplication records, plus two notification enum values. SQL was
  checked offline; the migration has not been applied to a shared database.
- Signature verification happens before recording an event. Supported events
  save only event/type/object/customer references and processing metadata, not
  raw payloads or payment/clinical details. Duplicate completed deliveries return
  success; failures and busy/backoff deliveries return 503 so Stripe can retry.
- A five-minute lease claims work with a conditional database update. The
  scheduler scans every five minutes, recovering pending/expired claims and
  failed attempts with exponential backoff capped at six hours. Each attempt
  retrieves the current Stripe invoice/subscription and verifies its identity
  and mode. Recovery does not depend on Stripe retaining the original Event.
- This is **at-least-once processing**, not a claim of atomic exactly-once
  delivery: handlers can commit before a process crashes. Existing subscription
  reconciliation, settlement idempotency, and notice deduplication must remain
  safe to repeat. A failed event is never deliberately acknowledged as complete.
- `/billing-operations` lists the oldest 100 unfinished messages across agencies,
  with attempts, generic error codes, and next retry eligibility; it refreshes
  every minute. Repeated failures require operator investigation. There is no
  button that erases receipts or blindly forces charges.
- Subscribe the Stripe endpoint to `invoice.created`, `invoice.payment_failed`,
  `invoice.payment_succeeded`, `invoice.paid`, `invoice.voided`,
  `invoice.marked_uncollectible`, and subscription created/updated/deleted.
  Configure and verify these subscriptions in sandbox before live rollout.
- `BILLING_NOTIFICATIONS_ENABLED=false` by default. When enabled, the existing
  admin notification bell receives trial reminders within three days and one day
  of confirmed trial expiry, at most one of each per trial end. A missed earlier
  window does not send both at once. Stripe cancellation is checked before the
  message is composed. These are **in-app notices**, not email/SMS delivery.
- Failed invoice alerts are deduplicated per agency/invoice and resolve when a
  paid/void event is processed. Current invoice state is re-read under the agency
  lock, so stale failures do not reopen resolved alerts. Staff cannot manually
  mark payment alerts resolved. Marking notifications read remains available in
  read-only accounts; billing recovery links remain accessible.
- The notice record and notification commit together. Deduplication survives
  purging old notification rows. Flags disabled during deployment do not backfill
  completed historical payment events; enable before accepting new paid trials.
- Verification includes real local database receipt persistence/restart,
  duplicate and expired-lease recovery, ownership-token checks, sanitized error
  recording, signature rejection, notification timing/deduplication/rollback,
  operator access, and browser-free rendering. Live PostgreSQL concurrency,
  signed sandbox delivery/restart, and interactive browser checks remain staging
  gates. No customer messages or live Stripe changes were made during tests.

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
  amounts and settlement/payment states. The Billing page now displays invoice
  history, finalized usage, corrections, and settlement states. Operator review
  is available in the internal console described below.

## Customer history

- `GET /billing/invoices?before=<invoice_id>` returns 20 Stripe invoices per page,
  including totals and remaining balances. Cursor ownership is checked against
  the signed-in administrator's organization. Stripe errors are surfaced rather
  than presented as an empty history.
- `GET /billing/usage/periods?before=<period_id>` returns 20 finalized usage
  summaries, with a stable timestamp/ID cursor and no client or visit payload.
  Corrections and settlement details load only when a period is expanded.
- Both endpoints use the existing admin guard and service/repository boundaries.
  Billing remains accessible after subscription access expires. Invoice history
  also serves legacy accounts; finalized usage history belongs to the new flow.
- React query calls live in `useBillingHistory`; components show loading, empty,
  error and refresh states. Approved corrections update the displayed usage
  total but are not described as paid/refunded until settlement confirms it.
- No additional migration or live Stripe configuration is needed for this UI
  step. Earlier billing migrations still need to be deployed before rollout.
- Run `node scripts/verify-billing-history.mjs` from `admin-frontend` for
  browser-free rendering checks; backend coverage lives in `test_billing_history.py`.

## Internal billing controls

- `/billing-operations` is a separate authenticated route, independent of agency
  membership and subscription access. Existing operators also see a link from
  Settings > Billing. The server checks `BILLING_OPERATOR_USER_IDS` on every
  endpoint; owner/admin roles and editable user metadata cannot grant access.
  Sign in with an allowlisted account and open/bookmark the console URL.
- Search agencies with cursor pagination; inspect consent/card readiness, trial
  requests, founding reservation/conversion, held invoices, cutoff errors and
  pending/failed settlements. Responses omit payment-method IDs and raw Stripe
  attempt parameters. Issue lists explicitly indicate a 100-row category cap.
- Trial requests, founding reservation and unused reservation release use the
  existing services and their idempotency/eligibility rules. The console presents
  an agency-specific confirmation before requesting these actions. A queued
  trial request is never labeled as a confirmed Stripe activation.
- Finalized period selection exposes proposals, before/after usage totals,
  client references, original rates, decisions and operator audit events.
  Proposal retries reuse their request ID while the entered reason is unchanged.
  Approval requires a reason and explicit acknowledgement of the amount. The
  backend still rejects stale baselines, changed client sets and conflicting
  repeated decisions. Approval may queue later charges/refunds when enabled.
- Recheck reads Stripe history through the existing recovery service. It can
  create/reconcile period records for normal downstream jobs, but cannot reset
  settlement attempts, bypass review, force a charge or directly refund. Records
  requiring manual investigation remain visible; no unsafe reset endpoint exists.
- Onboarding and settlement switches are visible but cannot be changed from the
  browser. No operator IDs, rollout flags, live prices or migrations were changed
  while implementing this console. No operational action was run against a real
  agency as part of verification.
- Tests cover operator-only route dependencies, HTTP denial for regular owners,
  service-layer checks before queries, literal search/pagination, issue scoping,
  redacted responses, guarded recovery, and rendered correction confirmations.

## Upcoming charge breakdown

- `GET /billing/upcoming` is admin-only and scoped to persisted organization
  membership. It reads agreed plan terms, subscription dates, closed periods,
  snapshots and approved corrections. It does not call Stripe or mutate billing.
- The Billing page shows the next base renewal (annual or monthly), first base
  payment after trial, completed periods awaiting finalization/invoicing, and
  approved corrections still in progress. Current usage estimates stay separate.
- Unknown usage is null, never zero. Finalized zero usage remains explicitly
  zero. Already-invoiced usage is excluded; outstanding correction invoices are
  labeled as already invoiced. Credits/refunds are not subtracted from a guessed
  next-charge total because they can settle against earlier invoices.
- A scheduled founding conversion supplies its new standard rate. An unresolved
  transition, stale renewal date, collection problem, cutoff review or missing
  history reconciliation displays uncertainty rather than a confirmed amount.
- Dates are recorded billing boundaries, not promised debit dates. All amounts
  are before tax; the actual Stripe invoice confirms taxes and collection timing.
  No new migration, price configuration or production rollout was performed.

## Read-only subscription access

- `domain/billing_access.py` is the shared entitlement policy for Billing status
  and backend writes. Active subscriptions, unexpired trials and onboarding
  before its deadline allow operations. End boundaries are exclusive. Legacy
  agencies retain their 14-day trial measured from creation.
- When entitlement ends, operational POST/PUT/PATCH/DELETE requests return
  `403 BILLING_READ_ONLY` before endpoint execution. API dependencies resolve
  organization membership from persisted records, not user metadata. Admin and
  worker routers are covered; route-inventory tests catch unguarded additions.
- GET requests retain existing role and organization checks. Billing recovery,
  signed Stripe webhooks, legal acceptance, organization registration and owner
  account closure keep their existing authorization. Invite acceptance checks
  the persisted invitation's organization before creating membership records.
- Cancellation at period end keeps access while Stripe reports active paid
  coverage. A canceled/unpaid/paused/incomplete enrolled subscription does not
  regain access just because its stored period end is in the future.
- The admin shell permits browsing/exporting with a persistent read-only notice.
  Existing mutation controls may remain visible, but the server rejects writes
  with a recovery message. Billing stays reachable; legacy owners can open the
  Stripe portal after expiry/cancellation. Status refreshes every minute.
- No new migration or Stripe call is needed to authorize a write. Decisions use
  persisted subscription status, updated by signed webhooks. Delayed webhook
  reconciliation remains an operational consideration. Internal billing jobs and
  historical completion/evidence maintenance are not blocked by the API guard.
- This guard applies to legacy and enrolled organizations when this code is
  deployed; pricing rollout flags do not bypass it. It does not enable charging.
- Verified by entitlement boundary, mutation interception, route coverage,
  database membership and pre-membership invitation tests in `test_billing_access.py`.

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
