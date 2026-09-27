# Billing onboarding rollout

This branch adds owner-authorized card setup and queued Stripe trial activation.
It does not complete active-client invoicing, founding conversion/notice delivery, read-only
backend access, trial reminder delivery, or the operator UI. Keep rollout disabled
until those release requirements and end-to-end staging checks are complete.

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
  numbers to 1–3. Allocation and release lock the agency, then all three slot rows
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
  saved agency timezone to the counter. The Billing count/breakdown interface
  remains the next frontend step.
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
