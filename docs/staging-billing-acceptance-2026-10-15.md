# Staging billing acceptance

Checked October 15, 2026. Staging billing is configured for Stripe test mode. Checkout, bank authentication, failed-payment recovery, subscription changes, cancellation, usage collection and refunds passed the checks below. Production was not changed.

## Configuration and deployed fix

Railway project `ad7d0852-3a98-45b7-bc0d-01068f7d3f95`, staging environment `897ce01e-e127-4d01-b0b4-e16940b7aeba`, backend service `6cabae5f-e461-44ef-bc57-c9ccb0db3624`:

| Setting | Verified configuration applied |
| --- | --- |
| `BILLING_ONBOARDING_ENABLED` | `true` |
| `BILLING_USAGE_FINALIZATION_ENABLED` | `true` |
| `BILLING_SETTLEMENT_ENABLED` | `true` |
| `BILLING_NOTIFICATIONS_ENABLED` | `true` |
| `BILLING_SETTLEMENT_LIVE_ENABLED` | `false` |
| `BILLING_USAGE_TAX_MODE` | `none` |

The existing Stripe account, base prices, usage prices and webhook endpoint were already configured. Startup validation on final deployment `ec5f36cb-2bc6-45d3-9bad-31a44a9ed8b0` reports all five prices valid in test mode, account `acct_1TTYFVDwdrtTklyu`, a configured signing secret, and no configuration errors. The service has one healthy replica. No database migration was needed.

Acceptance found that current saved-price usage invoices sent both `pricing` and `tax_behavior`, which Stripe rejects. Commit `5555cb7157611ff7e827a7ad2b008c2a4644ea6b` removes the redundant inline tax behavior from the outgoing saved-price request. It retains the persisted request parameters and idempotency key so recovery remains consistent. Historical inline-rate invoices retain their explicit tax behavior. The fix is deployed on staging; it has not been promoted to production.

The sandbox scripts now exercise current saved usage prices. The monthly script no longer incorrectly expects annual usage to be collected monthly; the separate annual script verifies annual accrual and collection.

Fresh-account browser testing also found that immutable Vercel preview URLs use `homecare-…-fumezs-projects.vercel.app`, while the API allowed only the older `homecare-app-…` pattern. Commit `c680d1582687652ea61e30d5046ca23334aafca6` supports both project prefixes within the owning Vercel team and rejects other teams and lookalike hostnames. Six preflight regression checks passed. Fresh-account sign-in and workspace access then succeeded on the deployed preview.

The first-purchase browser run found a stale card display after checkout: the page could retain its cached empty profile until reloaded. Commit `d2c6979375fdc70af6d2efc7ea51afe801faa2f3` refreshes billing profile and details after embedded confirmation. A regression test starts with a fresh cached empty profile and verifies that the saved/default card appears without reloading. It passed, along with the frontend build and hook lint. [Vercel staging deployment](https://vercel.com/fumezs-projects/homecare-app/J6hC9YrQwDc5TYLUZSRorCd44cqw) succeeded; the canonical staging site serves `/assets/index-Bpfsyt_X.js` containing the fix. [Frontend CI](https://github.com/fumzy123/homecare-app/actions/runs/38738669324) passed lint/type checks and build. The existing Vercel connector cannot inspect this team (403), so GitHub deployment status and the actual served bundle supplied deployment confirmation.

## Acceptance results

| Scenario | Result and scope |
| --- | --- |
| Hosted setup after trial expiry | Disposable agency created through the staging API. Stripe hosted setup saved the decline-after-attachment test card. |
| Declined first payment | Subscription became `incomplete`; staging API reported `can_write=false` and `is_read_only=true`. No paid access was granted. |
| Recovery and bank authentication | Hosted invoice recovered using Stripe's 3DS2 test card and its simulated bank challenge. Invoice `in_1UQnkzDwdrtTklyu7XkWldfM` was paid for CAD 350; agency write access returned. |
| Repeated confirmation | Two further staging confirmations retained exactly one subscription. |
| Plan changes | Staging browser scheduled monthly-to-annual billing at renewal and withdrew it successfully. Disposable agency API repeated the same change quote safely, then withdrew it. Original agency remained monthly. |
| Card management | Staging setup-intent and confirmation routes set a replacement Visa as default. Removing the default returned `409 DEFAULT_CARD`; removing the old cards succeeded. |
| Cancellation | Staging API set monthly cancellation at period end while preserving already-paid access. The deployed browser also cancelled the disposable annual agency's renewal, displayed “Renewal canceled,” and retained paid access. |
| Signed delivery | Checkout, subscription, failed-payment and paid-invoice receipts completed through the existing staging endpoint. Invalid signatures returned 400. Two Stripe CLI resends of the same event did not reprocess its completed receipt. |
| Scheduler and restart recovery | An expired processing claim on the disposable agency's prior failed-payment event was recovered by the five-minute scheduler. The test was repeated across deployment restart; the new backend completed attempt 3 at 12:43:24 UTC without reopening the paid invoice's alert. |
| Payment notice recovery | One failed-payment notice was created and then resolved after payment; replay of the old failed event did not reopen it. |
| Operator boundary | Ordinary agency owner received 403 from the billing operator route. No operator privileges were added. |
| Trial conversion | Disposable Stripe clocks: monthly CAD 350, annual CAD 3,360, and cancellation before conversion CAD 0. |
| Trial and expired purchase rules | Service-backed Stripe tests: remaining trial preserved; expired monthly and annual purchases charged the expected base prices; duplicate activation retained one subscription. |
| Monthly usage and refund | Real Stripe test clock with in-memory application records: renewal collected CAD 450 (CAD 350 base plus CAD 100 usage), refund CAD 5, repeated settlement reused the invoice. |
| Annual usage | Real Stripe test clocks with in-memory application records: 12 monthly usage entries accrued; renewal collected CAD 5,760 (CAD 3,360 base plus CAD 2,400 usage). Annual cancellation collected CAD 2,400 usage only. Repeats created no duplicate invoice. |
| Staging PostgreSQL settlement | Current application services, invoked by a local acceptance runner against staging PostgreSQL and Stripe test mode, collected CAD 10 from a clearly synthetic finalized usage snapshot. Invoice `in_1UQnwoDwdrtTklyuiwtqdCUC` was paid; retry reused it. This verifies settlement persistence and collection, not clinical usage counting or the 15-minute scheduler cadence. |
| Founding transition | Real Stripe clocks and conversion service: protected renewal CAD 200, later standard renewal CAD 350; duplicate notice prevented and cancellation before/after transition passed. |
| Month-end boundaries | Real Stripe clocks verified January 31–February 28, February 28–March 31 and March 31–April 30 usage windows for both monthly and annual base plans. The script's entitlement fixture was updated to include current subscription status/trial-start fields. |
| Embedded first purchase | A separate disposable agency signed in through the deployed preview, selected annual billing, saved a Stripe test card and completed the embedded first payment. The UI showed Standard Annual and paid invoice `378L8IOY-0001`; Stripe invoice `in_1UQo8ADwdrtTklyubFUv1MAu` confirms CAD 3,360 paid in test mode. Before payment, access stayed read-only; afterward the staging API reported active paid access. |
| Visit-to-usage finalization | On that agency, the hosted staging API created 13 fictional clients and 13 visits: 11 qualifying clients, one cancelled-only client, one without visits, and a repeated visit for one qualifying client. The hosted usage endpoint counted exactly 11, with CAD 10 additional usage. Current application services against staging PostgreSQL verified the real paid annual invoice, rejected finalization one second before the 72-hour deadline, captured the cutoff and finalized one second afterward. Repetition returned the same snapshot. The hosted finalized endpoint matched, and annual settlement accrued CAD 10 without issuing a monthly charge. Only the service's `now` argument was advanced; this is a simulated deadline, not an observed month-long wait or proof of the 15-minute scheduler cadence. No finalized usage snapshot was seeded for this check. |

## Automated validation

- Full backend suite: **698 passed, 24 skipped**. The skips require an isolated PostgreSQL database for care-coverage and Action Tower integration tests; they are separate from billing acceptance. One existing Starlette/httpx deprecation warning remains.
- Focused billing suite after the fix: **289 passed**.
- Lint passed for the changed backend files. The card-refresh hook also passed lint; the repository ESLint configuration does not lint JSX test files.
- [Final backend CI](https://github.com/fumzy123/homecare-app/actions/runs/38737157966) passed unit tests, lint, security audit and build/import checks for the deployed commit. The usage fix also passed its earlier [CI run](https://github.com/fumzy123/homecare-app/actions/runs/38735982645).
- Stripe sandbox runs: `verify_embedded_billing_sandbox.py`, `verify_self_service_sandbox.py`, `verify_trial_conversion_sandbox.py`, `verify_usage_settlement_sandbox.py`, `verify_annual_billing_sandbox.py`, `verify_founding_conversion_sandbox.py`, and `verify_usage_periods_sandbox.py` passed. These scripts reject live keys and clean up their disposable Stripe clocks/customers.

To repeat current-price usage tests, provide the test account ID and `STRIPE_STANDARD_ADDITIONAL_CLIENT_PRICE_ID` alongside the matching test key and base prices. The repository's local environment files did not contain those two additional settings during this run. Do not copy staging credentials into production or assume the local webhook signing secret matches the hosted endpoint; use Stripe's resend mechanism for hosted delivery verification.

## Remaining release acceptance

The staging billing checks above cover the deployed first purchase, hosted payment recovery, recurring billing using Stripe clocks, visit counting and simulated cutoff/finalization against staging PostgreSQL, annual accrual, and invoice collection. They do not replace the complete clinical agency walkthrough or Android testing. The scheduled billing jobs are enabled; webhook retry and restart recovery were observed, while usage deadlines were simulated through service calls. Automatic tax was not tested: staging uses `none`; production tax requirements and configuration remain a separate release decision.

Production billing switches, live webhook delivery, operator access, monitoring and the production promotion remain outside this staging-only change. No real payment was made.

## Test cleanup and evidence

Both disposable agencies (`acc979b6-a1d3-4fa7-ae56-86dc95e60ea2` and `9d4232fd-d559-4278-8d66-bff552cbecb9`) were deactivated and soft-deleted through the staging organization API. Their subscriptions were cancelled, Stripe test customers deleted, and test Auth users removed. Database verification found both agencies inactive/deleted with cancelled subscriptions, zero remaining acceptance Auth accounts, and **23 completed webhook receipts** for those agencies. Synthetic audit/history records remain retained under the deleted agencies. Acceptance-state files have had passwords and access tokens removed. The pre-existing agency's monthly plan was restored after its plan-change test.

Browser evidence is saved locally in `.cache/staging-billing-paid.jpg` (CAD 350 paid after bank authentication), `.cache/staging-billing-annual-active.jpg` (annual subscription and paid CAD 3,360 invoice), and `.cache/staging-billing-cancellation.jpg` (annual renewal cancelled with paid access retained). These are test-mode screenshots; private temporary runner state is ignored by Git.
