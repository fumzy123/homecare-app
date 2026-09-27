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
- Operator listing and Billing expose protection expiry and notice due date.
  Automated 30-day notice delivery and month-13 Stripe repricing are **not yet
  implemented**. Keep rollout disabled until these are built and verified.
- `scripts/verify_founding_sandbox.py` provisions/reuses only the test-mode CAD
  founding price and verifies zero-dollar trial creation and duplicate retries.
- Allocation tests cover capacity, replay, release, payment, and forfeiture.
  Real PostgreSQL concurrent-transaction verification remains a staging check.

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
- These scripts reject live keys. The first writes only sandbox price IDs to
  ignored `.env.local`; neither enables rollout or changes application data.
- Database migration SQL can be generated offline. Real database migration,
  concurrency verification, hosted Checkout UI/3DS testing, and deployed webhook
  delivery remain staging checks; API smoke tests do not replace them.
