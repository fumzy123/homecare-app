# Self-service subscriptions (2026-09-29)

This supersedes the enrollment restriction and operator-first purchase flow in
the older BILLING_ONBOARDING.md. Production release checks still apply.

Owners open `/upgrade` or Settings > Billing, select the current monthly/annual
plan, set their agency timezone, and accept billing consent. New purchases use
the configured versioned CAD Stripe prices, verified against the displayed offer.
Founding is shown only for a reserved offer. Manual enrollment is not required.

Stripe Checkout saves a verified payment method. Confirmation creates the
subscription automatically. The existing trial end is retained; expired trials
receive a first invoice immediately. Payment authentication uses Stripe's hosted
invoice. Access requires a trial entitlement or confirmed active subscription.
Failed/incomplete payment does not unlock paid operations. Billing stays reachable.

`checkout.session.completed` must be included in the signed webhook destination.
It reconciles only the session stored for that agency. The browser return and
background activation job also reconcile, using the existing durable activation
request and idempotency key. A payment-status button reconciles remote payment
success without requiring the customer to wait for webhook delivery.

For existing local accounts, the original signup + 14-day trial is preserved.
For agencies still onboarding, the initial planned end is the original onboarding
deadline + 14 days. Operator completion can move that start/end earlier under the
existing onboarding rule, updating the same subscription. It is not a prerequisite
to subscribing. No additional free trial is granted on purchase.

Immediate purchases use Stripe's subscription start as the paid-usage anchor in
the existing `trial_ends_at` field. The original free window remains in the durable
activation request. Usage before purchase is not billed retroactively.

## Local configuration

- `BILLING_ONBOARDING_ENABLED=true` enables this flow and the activation job.
- Use `sk_test_`/`rk_test_` keys and the configured Standard monthly/annual v1 prices.
- Restart the backend after changing its environment file.
- No new migration is added by this fix; the branch's existing migrations are required.
- Do not enable production settlement merely to test subscription checkout.

## Internal controls

`http://localhost:5173/billing-operations` is a cross-agency operator console.
Authorize yourself with `BILLING_OPERATOR_USER_IDS=["your-supabase-auth-user-id"]`
in the backend environment, then restart it. Use the Supabase Auth user ID, not an
agency or employment ID. This does not create a login. Agency owner/admin roles
do not grant cross-agency access. Customer purchasing requires only agency ownership.

## Verification

`scripts/verify_self_service_sandbox.py` rejects live keys, uses actual Stripe
subscriptions with in-memory repositories, and removes its disposable customers.
It verifies expired monthly/annual purchases, a two-hour remaining trial, exact
invoice amounts, and duplicate activation. It does not verify browser navigation,
3DS UI, or deployed webhook delivery. Automated tests cover consent, ownership,
failed payments, webhook session scoping, and onboarding completion after purchase.

Frontend rendering checks: `node scripts/verify-self-service-upgrade.mjs`.
