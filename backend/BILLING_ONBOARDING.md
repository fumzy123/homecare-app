# Billing onboarding rollout

This branch implements owner-authorized card setup, trial activation, founding
allocation/conversion with in-app notices, monthly usage evidence and finalization,
and reviewed adjustment records. Stripe settlement, customer history, and backend
read-only access are implemented. Trial reminders remain unfinished. The operator UI is implemented; see BILLING_SETTLEMENT.md.
Keep rollout disabled until release requirements and staging checks are complete.

## Configuration

- `BILLING_ONBOARDING_ENABLED=false` by default. When enabled, newly registered
  organizations receive a 30-day onboarding deadline. Existing agencies are not
  automatically enrolled or migrated.
- `BILLING_OPERATOR_USER_IDS` is a JSON list of trusted authenticated user IDs.
  Agency owner/admin roles and user metadata cannot grant operator access.
- `STRIPE_STANDARD_MONTHLY_V1_PRICE_ID`: CAD 300/month.
- `STRIPE_STANDARD_ANNUAL_V1_PRICE_ID`: CAD 3000/year.
- `STRIPE_FOUNDING_MONTHLY_V1_PRICE_ID`: CAD 200/month, offered only to reserved agencies.
- Existing Stripe secret/webhook keys remain server-only. Sandbox and live IDs
  must not be mixed. The legacy single-price checkout remains for legacy accounts.
- Apply the branch's Alembic migrations before running the updated application;
  adding nullable columns does not remove the need to migrate the schema.

## Flow

1. Owner opens Settings > Billing, chooses Standard monthly/yearly, and explicitly
   accepts the versioned automatic-billing authorization. The service resolves
   prices server-side and checks currency, interval, and amount against Stripe.
2. A Stripe-hosted setup-only Checkout session collects a card without charging.
   On return, the app confirms setup with Stripe. Manual retry is available;
   the activation job also reconciles a completed setup if the browser never returns.
3. A trusted operator calls `POST /api/billing/operator/organizations/{org_id}/trial-activation`
   after onboarding is complete. The 15-minute backstop queues due agencies using
   their original deadline, not the job's execution time.
4. The processor requires recorded consent and a succeeded customer-owned card
   setup. It creates a trial with an explicit end date and saves Stripe's confirmed
   dates. Founding is offered only when an operator has allocated a slot before
   billing authorization; founders cannot select annual billing.
5. Owner cancellation stops renewal/conversion. Billing remains reachable through
   the frontend's expired-access gate; complete read-only operational access is a
   later step. Payment-method and invoice management use the Stripe portal.

## Founding allocation

- Operator routes: `GET /api/billing/operator/founding-offers`, and
  `POST /api/billing/operator/organizations/{org_id}/founding-offer` to reserve,
  with `/release` appended to release an unused reservation.
- Migration seeds exactly three slots, with a database check constraining slot
  numbers to 1â€“3. Allocation and release lock the agency, then all three slot rows
  in fixed order. A fourth concurrent reservation must wait and then fail.
- Each agency has permanent offer history. Repeated reservation returns the same
  slot; a released/forfeited offer cannot be granted again to that agency.
- Only reservations without any billing agreement/subscription can be released
  automatically. Authorized or uncertain Stripe state requires reconciliation;
  paid slots are never reused, even after cancellation.
- A positive paid invoice linked to the agency's subscription records protection
  from its trial-end/first-paid-period boundary for twelve calendar months.
  Later paid invoices cannot reset it. API and Stripe-portal cancellations forfeit
  eligibility for future subscriptions without repricing the current prepaid period.
- Operator listing and Billing expose protection expiry and conversion state.
  A 15-minute job starts preparing conversion 45 days before protection ends.
  It atomically publishes an admin in-app notification and an immutable record
  of the exact Standard monthly base, allowance, additional-client rate, and date.
  Billing retains the notice even after it falls out of the notification feed.
  This step implements in-app notices, not email delivery.
- The date is a monthly Stripe billing anchor after both protection expiry and
  at least 31 days from notice preparation (one day of margin for publication).
  Late preparation therefore gives an extra protected renewal rather than less
  than 30 days' notice. Original founding consent is never overwritten.
- Stripe schedules retain the founding base until the announced boundary, then
  switch to the frozen Standard price without proration. The schedule releases
  after one Standard month, leaving the monthly subscription running. Usage
  counting/invoicing is a later step and must use the conversion's rate history.
- Cancellation releases our schedule before stopping renewal, including during
  its final Standard phase. An unknown external schedule is never overwritten.
  Remote success is reconciled using schedule identity/metadata and deterministic
  keys; an ambiguous create beyond 23 hours, removed schedule, or missed transition
  becomes `needs_review`. Operators see this through the founding-offers endpoint.
  Reconcile the remote state before repairing the record; never automatically
  backdate a failed transition or reuse the original notice for different rates.
- Migration `a8e2f6b3c175` adds the conversion audit table and notification enum.
  Keep rollout disabled until the remaining usage billing and staging checks pass.
- `scripts/verify_founding_sandbox.py` provisions/reuses only the test-mode CAD
  founding price and verifies zero-dollar trial creation and duplicate retries.
- Allocation tests cover capacity, replay, release, payment, and forfeiture.
  Real PostgreSQL concurrent-transaction verification remains a staging check.

## Active-client counting foundation

- `BillingUsageService.estimate` is an internal, read-only calculator. It requires
  a resolved organization ID, exact aware period boundaries, and an explicit IANA
  agency timezone. It returns an estimate and one qualifying visit reference per
  client. It neither creates invoices nor persists a billable flag.
- `BillingUsageRepository` scopes one SQL statement to the organization and a
  coarse local date window. It includes recurring masters that can intersect the
  period, overrides moved into it from outside, and existing completed/no-show
  evidence on canceled/deleted masters. A bounded outer join fetches overrides
  without lazy loads or modifying managed ORM relationship collections.
- The domain calculator uses the existing recurrence and effective-occurrence
  helpers, then compares the effective start against `[period_start, period_end)`.
  Scheduled, in-progress, completed and no-show visits qualify; canceled/dropped
  visits do not. It stops evaluating a client's remaining visits once matched.
  Registry status, client/worker archival, care plans and placements are irrelevant.
- Shift timestamps currently contain local wall time without offsets. Both DST
  folds qualify when they fall in the same usage window. A fold straddling a billing
  boundary, or a nonexistent spring-forward time, requires review instead of an
  arbitrary charge. No browser/server timezone fallback is permitted.
- `GET /api/billing/usage/current` now supplies server-selected dates and the
  saved agency timezone to the counter. Billing displays the current count,
  monthly allowance, additional-client estimate and searchable visit evidence.
- Before usage invoicing, preserve scheduling change history and finalized
  per-client evidence. Some existing edit/truncation paths delete overrides or
  rewrite masters; the estimate can only use surviving data. Do not calculate
  historical final invoices solely from mutable current schedule rows.
- Tests execute the candidate query against isolated SQLite tables, checking
  tenant isolation, moved occurrences and absence of N+1 queries, alongside
  recurrence/status/timezone domain tests. PostgreSQL query-plan measurements
  against realistic staging data remain a rollout check.

## Agency timezone and monthly period records

- The owner selects an IANA timezone in Billing and saves it using
  `PUT /api/billing/timezone`. No timezone is inferred or backfilled by migration.
  An initial choice is permitted for an enrolled agency missing its timezone;
  changes to an existing choice after subscription creation require review.
  Billing authorization and new trial subscription creation require a saved zone.
- Migration `b9f3a7c4d286` adds `organizations.billing_timezone` and
  `billing_periods`. Current-period creation locks the organization and has a
  unique organization/subscription/start constraint. Retries reuse the period.
  Its timezone, plan version, allowance, currency and per-client rate are snapshots;
  the current catalog never rewrites stored terms.
- `GET /api/billing/usage/current` is admin-only; dates, timezone and tenant ID
  cannot be selected by the browser. It fetches the agency's current subscription
  from Stripe and verifies customer, price, quantity and period before counting.
  Owners alone can change the timezone. Workers cannot read this usage endpoint.
- For monthly plans, the confirmed Stripe item dates must match the original
  paid anchor. Annual plans derive monthly windows from that same anchor and
  verify they lie within Stripe's annual coverage. Month-end clamping always
  uses the original day/time, so January 31 returns to March 31 after February.
  Drift or unexpected pricing fails closed for review rather than guessing.
- Trial/onboarding periods return `not_started`; inactive subscriptions return
  `no_current_period`. Usage estimates contain only additional-client charges,
  never a monthly share of the annual base. Finalization eligibility is recorded
  as period end + 72 hours, but no finalization or invoice is triggered here.
- Period records are currently created on demand for the current period only.
  Historical catch-up, preserved visit evidence, finalized counts, adjustments
  and usage invoice delivery remain separate work before rollout. The record's
  existence does not mean the period is finalized or that payment succeeded.
- `scripts/verify_usage_periods_sandbox.py` exercises the actual service against
  disposable Stripe monthly/annual test-clock subscriptions across January 31,
  February 28 and March 31, with in-memory repositories. It deletes its clock
  and customers and never touches the application database.

## Current usage in Billing

- The new-flow Billing page includes a Layer 3 usage section with a dedicated
  TanStack Query hook, and a props-only Layer 2 details view. Loading, no timezone,
  trial, inactive subscription, zero clients, search-empty, and failure states are
  explicit. Failed refreshes hide stale figures. The query refreshes on entry,
  every minute while visible, and on request; it is scoped by signed-in user,
  saved timezone and subscription status.
- The summary shows exact agency-local period boundaries, calculation time,
  included and additional clients, per-client rate, additional-client subtotal,
  and the 72-hour correction deadline. It is explicitly an estimate, excludes
  base/tax/adjustments, and explains monthly usage for annually billed agencies.
- The table is searchable and paginated, with one qualifying visit per client.
  Display names are fetched in one additional tenant-scoped query, including
  archived clients. Only names and archival status are added; no care details are
  returned or sent to Stripe. Unavailable names retain the counted client ID.
- `node scripts/check-billing-usage-ui.mjs` in `admin-frontend` checks static React
  rendering, annual amount wording, visit evidence, pagination, zero usage,
  HTML escaping, and browser-independent agency wall-time formatting. This does
  not replace a browser/staging walkthrough after migrations are applied.

## Historical visit evidence

- Apply migration `c0a4b8d5e397` before deploying this code. It adds the versioned
  `billing_visit_evidence` table; it has not been applied to a shared database.
- Completed/no-show occurrence facts are copied before master edits, series
  splits/cancellations, or client archival. This happens inside the same
  transaction as the schedule change. Failure rolls both changes back.
- Explicit occurrence corrections append a revision. Master reassignment does
  not transfer the historical client; ordinary master changes cannot change a
  preserved visit's time. Note-only edits do not add financial revisions.
- Estimates combine the latest evidence with live schedule occurrences. Moved-out
  and cancelled versions suppress obsolete evidence; intentionally reopened
  scheduled visits count only while their current schedule remains live.
- The completion job uses the service/repository layers and the agency timezone
  (legacy agencies retain UTC; enrolled agencies without a timezone are skipped).
  Only scheduled visits are automatically completed, preserving dropped,
  cancelled, in-progress and no-show states. Start-only rescheduling inherits
  the duration at the new start. Completion and evidence commit together.
- All these writers lock parent shifts in a consistent order. PostgreSQL locking
  behavior still needs a staging concurrency check; SQLite tests verify
  transactions and counting, not PostgreSQL row-lock semantics.
- Evidence is append-only through application repositories. This is not an
  immutable invoice or a database-level ban on privileged administrative edits.
  No backfill can reconstruct overrides deleted before this release. Existing
  surviving historical overrides are captured before subsequent mutations.
- Recorded-period finalization and exact deadline capture are described below.
  Reviewed adjustments are described below. Invoice submission and adjustment
  settlement remain separate steps.

## Recorded-period usage finalization

- Migration `d1b5c9e6f408` adds one snapshot per period and indexes for due-period
  scans and agency history. It has not been applied to shared databases.
- The 15-minute job requires both `BILLING_ONBOARDING_ENABLED=true` and
  `BILLING_USAGE_FINALIZATION_ENABLED=true`. The latter defaults to false.
  Keep it disabled until staging verification and review of pre-tracking periods
  are complete. This step makes no Stripe calls and cannot charge customers.
- A dedicated READ COMMITTED transaction first locks the agency, then the
  period. Every scheduling writer takes that agency lock first. Reads see any
  changes committed while waiting for the lock, and usage cannot change during
  capture. Period locks and primary-key uniqueness prevent duplicate snapshots.
- Nothing finalizes before `ends_at + 72 hours`. At finalization, the service
  copies the saved period terms, one qualifying witness per distinct client,
  preserved evidence version IDs where applicable, and the additional-client
  count and amount. Annual plans still receive one monthly allowance. Base fees,
  taxes, payments, and invoice status are not part of the usage subtotal.
- Repeated finalization returns the existing snapshot without recounting or
  changing rates. Subsequent schedule/evidence corrections cannot rewrite it.
  Application code exposes no update/delete operation for snapshots; privileged
  database access is not prevented by this application-level immutability.
- Agency admins can read a snapshot using `GET /billing/usage/periods/{period_id}`.
  The route applies the existing admin guard and organization scope. Client
  labels/clinical data are not copied into the financial snapshot.
- Errors leave a period pending and logged; a failed count is never converted to
  zero usage. Each period owns a separate session/transaction, so one failure
  does not stop other agencies from finalizing.

## Period recovery and exact correction cutoff

- Migration `e2c6d0f7a519` adds price-independent cutoff records, the time agency
  usage tracking began, recovery status, and source invoice/line IDs on periods.
  No migration has been applied to shared databases. New cutoff records have
  RLS enabled with no Data API policies; only the backend database role accesses
  them, consistent with the SQLAlchemy architecture.
- Before shift creation, master/occurrence changes, cancellations, client
  archival, placement scheduling, or automatic completion, the service locks
  the agency and seals all windows whose `end + 72 hours` deadline has passed.
  This check runs independently of the finalization flag. It runs before any
  shift lock or mutation and commits/rolls back with the caller's transaction.
- The effective correction time is admission under that agency lock. A request
  admitted before the deadline may commit after it; the next writer waits and
  includes that accepted correction. A request waiting across the deadline is
  late. Operational changes remain allowed afterward, but cannot rewrite the
  cutoff record. This also excludes newly backdated visits from a closed count.
- Delayed workers are safe: the first late writer captures the last accepted
  pre-deadline state before changing it. If no writer intervened, the worker
  captures the same state. This guarantee covers application scheduling paths,
  not direct SQL/manual data changes that bypass these services.
- Tracking starts on the first eligible guard/maintenance pass, never backdated
  by the migration. Deadlines at/before tracking start are `needs_review`, with
  no invented count. Invalid or ambiguous visit times are likewise held for
  review, while operational edits remain usable. Such rows need explicit
  operator reconciliation; the service never silently recalculates them.
- `recover_billing_periods` runs every 15 minutes when onboarding rollout is
  enabled, even if finalization is disabled. It first persists overdue cutoffs,
  then reads all paginated Stripe invoices/line items with no DB lock held.
  It re-locks the agency and verifies the local context has not changed before
  recording any recovered periods.
- Coverage must match the owned customer/subscription, original paid anchor,
  exact agreed price, quantity, amount, currency, and full base interval. Trial
  lines, drafts, and manual items cannot establish coverage. Gaps, duplicate
  coverage, prorations, credit notes, unexpected prices, and void/uncollectible
  invoices fail closed. Month-end anchors never drift; annual coverage produces
  monthly windows only as they begin. Founding transitions use their recorded
  effective date and exact announced price, verified against each invoice.
- Cancellation uses Stripe `ended_at`, not request time. Full historical windows
  can be recovered; a partial last window is flagged for review rather than
  charged as a full month. An unresolved recovery error holds finalization.
- Recovery is idempotent. Existing terms are compared in full and never silently
  overwritten. Source invoice/line IDs are attached after successful verification.
  Error status and the last check time are recorded on the agency; errors are
  also logged without client care data.
- Finalization requires invoice-backed coverage verified within the last hour
  and a ready cutoff for the exact window/timezone. Snapshot schema v2 copies
  the cutoff's witnesses and saved rates; it never recounts late scheduling data.
  Recovery and finalization make no Stripe mutations or charges.

### Remaining launch verification and work

- Verify PostgreSQL concurrency with independent sessions: a correction waiting
  across the deadline, concurrent finalizers, and automatic completion competing
  with a user edit. SQLite tests cover real persistence/rollback, but cannot
  prove PostgreSQL row-lock behavior. Deploy migrations and all writers together;
  do not run older backend processes alongside guarded writers.
- Review pre-tracking/partial-cancellation/ambiguous-time periods explicitly.
  Usage adjustment settlement, invoice submission, and billing-history
  UI are still pending. Keep finalization disabled until those launch checks
  are complete and the configured backend role can access the RLS-protected table.

## Reviewed post-finalization adjustments

- Migration `f3d7e1a8b620` adds adjustment proposals and append-only decision
  events. Both tables have RLS enabled, with no Data API policies. This migration
  is prepared only; it has not been applied to shared databases.
- A configured Care Harbor billing operator proposes a correction using the
  finalized period ID, a unique request UUID, and a reason. The backend recounts
  current qualifying clients using the same occurrence/evidence rules, then
  compares them with the original snapshot or latest approved correction.
- The amount is the difference between the old and corrected overage at the
  original period's saved allowance and rate. It is never supplied by the caller.
  Positive amounts are additional usage; negative amounts are credits. Counts
  below the allowance cannot produce excessive credits. Annual base charges are
  excluded; founding-period corrections retain their historical additional rate.
- Proposals retain the before/after client evidence, added/removed client IDs,
  signed amount, reason, operator, and timestamp. Same-count client substitutions
  and changes below the allowance can be approved as zero-value corrections.
  Reasons should contain billing explanations, not clinical or sensitive care data.
- Approval or rejection records a separate audit event with the acting operator,
  decision reason, and timestamp. One configured operator may both propose and
  approve; this is deliberate for the initial owner-operated rollout, not a
  two-person approval policy. Agency admins cannot approve financial adjustments.
- Approvals serialize under the agency/period locks. An intervening approval
  invalidates the previous baseline; a changed client set invalidates the proposal.
  Create a new proposal rather than silently recalculating the reviewed amount.
  Duplicate request IDs and identical decision retries return the existing result.
  Reusing a request for different content or reversing a decided proposal fails.
- Successive adjustments are incremental relative to the last approved total,
  including approved adjustments not yet settled in Stripe. The invoice worker
  must settle each approved nonzero adjustment once, in approval order, using its
  immutable ID. Never charge only the latest delta and drop earlier pending ones.
- Approval does NOT issue a refund, charge, or account credit. Nonzero approvals
  have `settlement_status=pending`; zero-value approvals are `not_required`.
  Rejected/pending proposals are `not_approved`. Stripe settlement, including
  the no-next-invoice case for cancelled agencies, is now implemented behind
  disabled rollout flags. See BILLING_SETTLEMENT.md for setup and verification.
- Cancelled/archived agencies retain this correction path. The original finalized
  snapshot, cutoff, invoice references, and pricing terms are never overwritten.
  Changes needed after an approval are a new correction, not an edit to its audit.

### Adjustment API

- Operator list/propose: `GET` / `POST`
  `/billing/operator/organizations/{org_id}/periods/{period_id}/adjustments`.
  Proposal body: `request_id` (UUID), `reason` (5–1000 nonblank characters).
- Operator decision: `POST`
  `/billing/operator/organizations/{org_id}/periods/{period_id}/adjustments/{adjustment_id}/decision`.
  Body: `decision` (`approved` or `rejected`) and `reason`.
- Agency admin history: `GET /billing/usage/periods/{period_id}/adjustments`.
  Organization scope comes from authenticated membership, never browser input.
- These are backend endpoints. The Billing/operator history and approval UI is
  still pending, as are automatic exception discovery and settlement controls.

## Recovery

- One activation request per organization; writes take the organization row lock.
- Persist the first Stripe attempt before sending it. Reuse a deterministic
  idempotency key and search the customer's subscriptions for activation metadata
  before retrying. An unrelated live subscription or multiple matches needs review.
- Beyond 23 hours from an ambiguous attempt, do not recreate automatically if
  reconciliation finds no match. This avoids relying on expired idempotency keys.
- A fully elapsed trial window becomes `needs_review`, never a retroactive charge.
- Worker catches/logs per-agency failures and continues. It does not mark failed
  Stripe calls as activated. Webhook processing errors now propagate for retries.
- Subscription updates fetch current remote state and use item-level period dates
  in Stripe SDK 15. Zero-dollar trial invoices do not establish a paid account.
- A cancellation during a partial Stripe/database failure also searches for the
  matching remote subscription before recording cancellation locally.

## Verification performed

- Focused unit/service tests cover consent, owner/operator boundaries, missing
  cards, foreign setup intents, retries, cancellation, dates, and webhook failures.
- `scripts/verify_billing_sandbox.py` provisions reusable sandbox-only prices and
  exercises setup, zero-dollar trial invoices, duplicate activation retries, and
  cancellation. It deletes its disposable customers/subscriptions.
- `scripts/verify_trial_conversion_sandbox.py` advances disposable test clocks
  through monthly/annual conversion and cancellation, then removes the clocks.
- `scripts/verify_founding_conversion_sandbox.py` uses the actual conversion
  service with in-memory repository substitutes and real Stripe test clocks.
  It simulates the final two protected months, verifies a CAD 200 renewal,
  a CAD 300 Standard renewal, retry reconciliation, and cancellation before and
  after the transition. It never touches the application database or live mode.
- These scripts reject live keys. The first writes only sandbox price IDs to
  ignored `.env.local`; neither enables rollout or changes application data.
- Database migration SQL can be generated offline. Real database migration,
  concurrency verification, hosted Checkout UI/3DS testing, and deployed webhook
  delivery remain staging checks; API smoke tests do not replace them.
