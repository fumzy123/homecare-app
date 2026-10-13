# Current billing configuration

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
