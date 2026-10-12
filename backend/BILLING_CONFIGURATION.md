# Current billing configuration

Only three base-price environment variables are used by the backend:

| Variable | CAD base price | Monthly charge per additional client above 10 |
| --- | --- | --- |
| `STRIPE_STANDARD_MONTHLY_V3_PRICE_ID` | $350/month | $10 |
| `STRIPE_STANDARD_ANNUAL_V3_PRICE_ID` | $3,360/year | $10 |
| `STRIPE_FOUNDING_MONTHLY_V2_PRICE_ID` | $200/month | $5 |

Keep their existing names and version numbers. All three price IDs, the backend
Stripe key, the frontend publishable key, and webhook endpoint must belong to
the same Stripe account/environment. Staging uses test credentials and prices;
production uses live credentials and prices. Price IDs themselves do not encode
live/test mode. No keys, prices, billing rollout flags or tax settings are changed
by this code cleanup.

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
