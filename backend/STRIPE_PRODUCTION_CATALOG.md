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
