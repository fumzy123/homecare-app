# In-app billing

Billing owners manage their profile, saved cards, plan selection, and cancellation
inside Care Harbor. Card data is collected by Stripe Elements. Setup-only Checkout
is embedded using Stripe's current `embedded_page` UI mode. Neither path sends raw
card numbers to the backend. Invoices can still link to Stripe's invoice documents.

Standard monthly/annual changes show a server-signed, 15-minute confirmation with
the base price and effective date. During a trial the selected price changes while
the existing trial end is preserved. Paid accounts switch at renewal via a Stripe
subscription schedule, without prorations. Monthly client usage keeps its original
anchor. Founding offers retain their protected monthly terms. Calendar-clamped
renewals that would change the usage anchor require a billing-date review.

Stripe schedule metadata identifies application-owned changes. Subscription
webhooks reconcile the current agreement, and invoice recovery retains each
historical invoice's monthly/annual terms. Pending changes can be withdrawn; plan
cancellation releases a pending change before canceling renewal. No migration is
required. The existing webhook endpoint must remain configured.

Verification:

- `python -m pytest tests -q`
- `python scripts/verify_embedded_billing_sandbox.py` (requires a Stripe test key;
  creates and removes disposable test customers, never reads/writes the app DB)
- Frontend typecheck/build and `scripts/verify-billing-overview.mjs` /
  `scripts/verify-self-service-upgrade.mjs`.

An authenticated browser check is still needed for the modal layout and bank
authentication interaction. A bank may require an external authentication step;
ordinary card and subscription management does not use the hosted customer portal.
