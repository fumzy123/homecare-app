# Current billing configuration

## Operator workspace and usage-price release (2026-10-14)

The normal sign-in page now sends authenticated users through `/workspace`.
That page checks `/api/billing/operator/access`: server-authorized operators open
`/billing-operations`; a forbidden response sends ordinary accounts to their
existing agency dashboard. Network/server failures offer retry, not a guessed role.
The operator workspace is outside the agency subscription/layout guards. It does
not create an agency or grant access to clinical records. All operator APIs retain
their backend allowlist guard; emails and editable user metadata grant no access.

Set `BILLING_OPERATOR_USER_IDS` to a JSON array of verified Supabase user IDs in
each Railway environment. Staging and production have different identity IDs,
even when an email is the same. The approved operator email is separate from the
agency-admin test email. Configuration changes require a backend deployment.

Agencies can submit billing review requests for their own periods; operators can
record a response in the internal queue. Request retries are idempotent and recorded
responses cannot be overwritten. Resolving a question does not issue a credit,
pause collection, or extend the 72-hour correction window. Financial changes use
the existing recorded adjustment workflow. Migration `c4e9812ab760` creates the
private review table and adds nullable Stripe price evidence to billing periods.

The additional-client product uses explicit one-time CAD prices on invoice items:

| Variable | Sandbox price | Live price |
| --- | --- | --- |
| `STRIPE_STANDARD_ADDITIONAL_CLIENT_PRICE_ID` | `price_1UQR8LDwdrtTklyuH12TKo6S` | `price_1UQRJsDwdrtTklyuxL6Yc8yi` |
| `STRIPE_FOUNDING_ADDITIONAL_CLIENT_PRICE_ID` | `price_1UQR8PDwdrtTklyujXBKFZkr` | `price_1UQRJvDwdrtTklyu1mqR8Om1` |

Current rates remain CAD 10 Standard / CAD 5 Founding per distinct additional
client above ten, without daily proration. Scheduled, in-progress, completed and
no-show visits qualify by visit start within the monthly period; cancelled/dropped
visits do not. Annual subscriptions retain monthly usage ledgers collected at
annual renewal. Each new period saves its usage price ID; finalization and settlement
preserve that ID alongside its unit rate. Historical periods without a price ID
keep their original amount-based settlement path. No historical backfill occurs.

Future rate changes require a new immutable pricing definition/Stripe price and
an explicitly agreed effective transition. Changing metadata, creating a Stripe
price, or replacing an environment variable alone must not reprice existing
agreements. The gateway checks the saved price against the recorded rate/account/
mode/currency before creating charges. This release does not add an arbitrary
future-rate scheduling screen; existing plan-transition safeguards remain.

For the current prelaunch setup, `BILLING_USAGE_TAX_MODE=none` and
`BILLING_SETTLEMENT_LIVE_ENABLED=false`. Do not enable live collection merely
because the application deployment succeeds. Complete signed webhook and full
staging settlement verification first, and revisit tax collection when the
business's actual registration status changes.

Validation: 696 backend tests passed (24 skipped), production frontend build,
`tests/billing-reviews.browser.cjs` and `tests/operator-login.browser.cjs` with
fictional local fixtures. The latter covers operator/agency landing and a failed
access check followed by retry. These checks do not assert a live-user login or
real production payment was performed.

Only three base-price environment variables are used by the backend:

| Variable | CAD base price | Monthly charge per additional client above 10 |
| --- | --- | --- |
| `STRIPE_STANDARD_MONTHLY_PRICE_ID` | $350/month | $10 |
| `STRIPE_STANDARD_ANNUAL_PRICE_ID` | $3,360/year | $10 |
| `STRIPE_FOUNDING_MONTHLY_PRICE_ID` | $200/month | $5 |

These configuration names do not contain plan versions. All three price IDs, the backend
Stripe key, the frontend publishable key, and webhook endpoint must belong to
the same Stripe account/environment. Staging uses test credentials and prices;
production uses live credentials and prices. Price IDs themselves do not encode
live/test mode. No keys, prices, billing rollout flags or tax settings are changed
by the configuration rename.

## Unversioned price-setting rollout (2026-10-13)

The settings, price resolver, provisioning script and verification scripts now
use the three unversioned names above. Stored billing agreement versions and
Stripe lookup keys/metadata retain their existing meaning; prices are not recreated.

Before deploying this rename, add the new names to each Railway environment with
the corresponding existing test/live price IDs documented below. Keep the old
names while the previous deployment is running. After the new deployment succeeds,
remove `STRIPE_STANDARD_MONTHLY_V3_PRICE_ID`, `STRIPE_STANDARD_ANNUAL_V3_PRICE_ID`,
and `STRIPE_FOUNDING_MONTHLY_V2_PRICE_ID` from that environment. The new code does
not fall back to those names. A rollback to the earlier release requires restoring
them. No database migration is needed for this configuration rename.

## Pre-launch cleanup (2026-10-12)

Read-only checks of both hosted application databases found no billing agreements,
no billing periods, and no organizations with a subscription ID. Each environment
has one organization. This is application-database evidence, not an assertion
that the Stripe account contains no standalone test or historical objects.

The runtime settings and sample environment no longer load these obsolete values:

```text
STRIPE_PRICE_ID
STRIPE_STANDARD_MONTHLY_V1_PRICE_ID
STRIPE_STANDARD_ANNUAL_V1_PRICE_ID
STRIPE_STANDARD_MONTHLY_V2_PRICE_ID
STRIPE_STANDARD_ANNUAL_V2_PRICE_ID
STRIPE_FOUNDING_MONTHLY_V1_PRICE_ID
```

Only current Standard price IDs participate in subscription reconciliation and
invoice-history recovery. Retired versions cannot fall back to current price IDs.
Historical pure rate definitions and database columns remain intact; this is not
a migration or rewrite of stored billing evidence. Sandbox verification scripts
now use current price variables and amounts. The old v2 provisioning script was
removed; `provision_current_pricing.py` remains the explicit provisioning entry.
Verification scripts no longer create obsolete prices as a side effect.

## Hosted cleanup sequence

1. Run the backend tests and lint before releasing the cleanup.
2. Confirm the hosted environment has the three current price variables above.
3. Remove only the obsolete variables listed above that exist in that environment.
   Leave Stripe keys, webhook secret, current prices and all billing switches alone.
4. Verify the deployment is healthy. Keep Stripe products/prices and application
   records intact. Do not enable live billing as part of configuration cleanup.

The Railway connector currently supports setting variables but not deleting them,
and the available browser is not signed in to Railway. Hosted deletions therefore
require the user's dashboard or an authenticated variable-deletion capability;
they have not been executed as part of the local cleanup.

## Stripe test-mode catalog cleanup (2026-10-13)

Verified account `acct_1TTYFVDwdrtTklyu`, test mode only. The complete subscription
list contained 11 cancelled subscriptions; both schedules were released and no
Payment Links existed. Archived six obsolete active prices and two old products.
Previously archived prices and historical subscriptions were retained.

The active catalog now contains only these existing products and prices:

| Product | Price label | Existing price ID |
| --- | --- | --- |
| Care Harbor Standard (`prod_VLpkSQIHZVv9XV`) | Standard monthly | `price_1UM8xeDwdrtTklyuYjChDMWv` |
| Care Harbor Standard (`prod_VLpkSQIHZVv9XV`) | Standard annual | `price_1UM8ysDwdrtTklyuFLmjWEEV` |
| Care Harbor Founding (`prod_VKpKNOcwY6CjtD`) | Founding monthly | `price_1UM8ysDwdrtTklyuST2nXZcl` |

Removed version numbers from the three current price nicknames. Re-read the
catalog to verify that IDs, amounts, recurrence, currency, lookup keys, metadata,
and tax settings were unchanged. Internal plan versions and environment variable
names remain compatible with the deployed code. The provisioning script now
uses these simpler nicknames when creating prices.

This catalog cleanup does not verify Railway's redacted price values or complete
the staging billing acceptance tests.

## Stripe live-mode catalog cleanup (2026-10-13)

After live-mode access was granted, verified account `acct_1TTYFVDwdrtTklyu`.
Complete lists contained no subscriptions, subscription schedules, or Payment
Links. Archived six obsolete active prices and two old products; retained both
previously archived one-time prices and all historical records.

| Product | Price label | Existing live price ID |
| --- | --- | --- |
| Care Harbor Standard (`prod_VLuPk6WrdnSgLn`) | Standard monthly | `price_1UM8u2DwdrtTklyuuHQHR6Vk` |
| Care Harbor Standard (`prod_VLuPk6WrdnSgLn`) | Standard annual | `price_1UM8uZDwdrtTklyuldBgmZg9` |
| Care Harbor Founding (`prod_VLuSJZehsWz44S`) | Founding monthly | `price_1UM8vqDwdrtTklyuLUmmDI3R` |

These are the only active products and prices after cleanup. Removed version
numbers from the three current price nicknames. Re-read both complete lists and
confirmed IDs, amounts, recurrence, currency, lookup keys, metadata, and tax
settings were unchanged. No hosted environment variables, subscriptions, or
application billing rules were modified. No payment was initiated. This does not
verify Railway's redacted values or certify production billing readiness.
