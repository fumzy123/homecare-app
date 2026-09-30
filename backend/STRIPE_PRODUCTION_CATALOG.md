# Stripe production catalog verification — 2026-09-29

Account: `acct_1TTYFVDwdrtTklyu` (Home Care Management Software).
Verified through the connected Stripe plugin in live mode. Sandbox values were
read separately using the local test credential. No customers were charged,
subscriptions changed, application deployed, or live settlement enabled.

## Current production prices

| Configuration | CAD amount | Live Stripe price |
| --- | --- | --- |
| `STRIPE_STANDARD_MONTHLY_V2_PRICE_ID` | $350/month | `price_1ULCgQDwdrtTklyu77l1FZzI` |
| `STRIPE_STANDARD_ANNUAL_V2_PRICE_ID` | $3,360/year | `price_1ULCgQDwdrtTklyuYLCNX4Ph` |
| `STRIPE_FOUNDING_MONTHLY_V1_PRICE_ID` | $200/month | `price_1ULCgiDwdrtTklyuRyuL0UH2` |

These prices are active, CAD, per-unit, licensed recurring prices with one-month
or one-year intervals. Their lookup keys and plan/version metadata match test.
Additional-client usage is calculated by the application and added to invoices;
it is not a separate recurring price in the test catalog.

## Historical prices also represented in production

| Test price | Live equivalent | Terms / status |
| --- | --- | --- |
| `price_1UK9I4DwdrtTklyuBhRCw16k` | `price_1ULCgjDwdrtTklyuKTeuoOvg` | CAD $300/month, active |
| `price_1UK9I4DwdrtTklyuwverUlwR` | `price_1ULCgkDwdrtTklyuUz5nELZA` | CAD $3,000/year, active |
| `price_1TXlyEDwdrtTklyuKtRP20Vr` | `price_1TXYBsDwdrtTklyu3RW2UQ2K` | USD $700/month, existing active equivalent |
| `price_1TTiptDwdrtTklyu4vJ0OJMU` | `price_1ULCglDwdrtTklyulRTXFe4L` | CAD $80 one-time, inactive |

The pre-existing legacy product is named `Home Care OS (Standard)` in live and
`Home Care OS (Stanadard)` in test. Its USD monthly lookup key is
`standard_montly` in live versus `standard_monthly` in test. These existing
labels were not changed, and no duplicate USD monthly price was created.
The extra inactive USD $80 live price was left intact.

All seven test price definitions have live financial equivalents. Historical
prices were retained as requested, but must not be selected for new checkout.
All inspected prices have `tax_behavior=unspecified`; catalog parity does not
confirm tax readiness.

## Verification findings and remaining launch checks

- Live webhook endpoint `we_1TTpgEDwdrtTklyugX8dFlfE` is enabled at
  `https://homecare-app-production.up.railway.app/api/billing/webhook`.
  Its event list is missing `invoice.created`, `invoice.payment_succeeded`,
  `invoice.voided`, and `invoice.marked_uncollectible` compared with the feature's
  supported events. In particular, `invoice.created` is needed for renewal
  invoice holds. Update and test the endpoint together with deployment of the
  compatible backend; its settings were not changed during this catalog copy.
- Local webhook signature verification rejected an invalid signature with 400
  and accepted a correctly signed unsupported probe with 200. This only checks
  routing/signatures, not supported-event processing or Stripe delivery.
- No local Stripe forwarding process was running at inspection. Real delivery,
  durable retry/restart, and renewal hold verification remain outstanding.
- Frontend and backend respond locally. The interactive signup/trial/purchase,
  card change, plan switching, cancellation, and expired-access walkthrough has
  not been completed in this audit.
- The local `.env.production` lacks the current live price mappings and a live
  secret key. Hosted environment variables were not inspected or changed.
  Configure the current IDs above securely during deployment, along with live
  keys, matching webhook secret, tax settings, and deliberate live billing flags.
- Terms, Privacy, and DPA pages still contain pre-launch draft placeholders.
  They have not received legal approval as part of this technical audit.
- Annual reminders are in-app notices about renewal and accumulated usage
  collection; email delivery remains unimplemented.
- Timezone setup/settings changes are committed as
  `8c7c368 feat(agency): configure timezone during setup and in settings`.

This audit records external configuration and observed checks. It does not
supersede the current billing policy or certify production launch readiness.

## Railway configuration follow-up — 2026-09-29

- Inspected Railway project `keen-clarity`, production environment, service
  `homecare-app`. The active deployment is
  `297f4292-5479-425b-9f6f-52ed0bd00350`, from September 25, on `main` commit
  `7e7a33282c733445a2451c121cac09772906a72e`. It predates this billing feature.
- Hosted variable names confirmed that `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET` exist. Railway OAuth hides their values, so key mode,
  validity, and signing-secret correspondence remain unverified.
- Saved the three current live price mappings above to the hosted service with
  `skipDeploys=true`. They apply on the next deployment; no redeploy was triggered.
- Explicitly saved `false` for `BILLING_ONBOARDING_ENABLED`,
  `BILLING_USAGE_FINALIZATION_ENABLED`, `BILLING_SETTLEMENT_ENABLED`,
  `BILLING_SETTLEMENT_LIVE_ENABLED`, and `BILLING_NOTIFICATIONS_ENABLED`.
  These flags guard the new implementation; they do not disable purchases in
  the currently deployed legacy code. The old `STRIPE_PRICE_ID` was unchanged.
- Re-read hosted variable names to verify the additions. Values are redacted;
  the successful write response confirms the submitted configuration.
- The live OpenAPI endpoint returned 200 and exposes only the legacy billing
  routes. A harmless probe with an invalid Stripe signature returned
  400 `INVALID_SIGNATURE`. No valid payment event was sent or replayed.
- The inspected recent Railway HTTP log sample contained no requests, providing
  no evidence of successful Stripe event delivery.
- The live webhook event list remains unchanged. Deploy the compatible backend
  and required database migrations before adding the missing invoice events and
  verifying actual delivery, retries, and annual renewal holds.
- Tax configuration remains unverified and was not changed. Complete that check
  before enabling live billing; no tax registration or tax exemption is assumed.

Next release sequence: finish sandbox acceptance, deploy this feature and its
migrations, verify live credentials/configuration, update the webhook event list,
and verify delivery before deliberately enabling the new billing workflow.
