# Billing onboarding rollout

This branch adds owner-authorized card setup and queued Stripe trial activation.
It does not complete active-client invoicing, founding eligibility, read-only
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
   dates. Standard plans only: founding eligibility is not exposed prematurely.
5. Owner cancellation stops renewal/conversion. Billing remains reachable through
   the frontend's expired-access gate; complete read-only operational access is a
   later step. Payment-method and invoice management use the Stripe portal.

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
