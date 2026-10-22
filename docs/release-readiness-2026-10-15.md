# Care Harbor staging and production release readiness

For the admin-only first-agency release, use the [admin release checklist](admin-release-checklist.md), prepared October 16, and its linked workflow and safeguards guides. The dated evidence below remains the historical staging/production baseline; its Android and Play gates belong to the separate mobile release unless the agency launch depends on mobile workflows.

Checked October 15, 2026. Staging and production have working, separate infrastructure and current database migrations. Neither environment has completed MVP acceptance. Begin with staging billing and push configuration, then test the complete agency and worker journey before promoting the tested release.

The initial inspection used read-only provider calls, database metadata and aggregate counts, public HTTP requests, deployed frontend bundles, and GitHub checks. Subsequent staging-only work completed [billing acceptance](staging-billing-acceptance-2026-10-15.md), the [agency walkthrough](staging-agency-walkthrough-2026-10-15.md), and [browser authentication checks](staging-browser-authentication-2026-10-15.md), including fixes through frontend commit `6eccb32`. Android device and push acceptance remain the next gates. Production was not changed.

## Verified environment baseline

| Check | Staging | Production |
| --- | --- | --- |
| Admin website | `https://homecare-app-git-staging-fumezs-projects.vercel.app` returns 200 | `https://www.careharbor.online` returns 200 |
| Compiled API connection | `https://homecare-app-staging.up.railway.app` | `https://homecare-app-production.up.railway.app` |
| Compiled Auth connection | `kqhnvgfailypobaogzwv.supabase.co` | `bawrfbuefavtqjqbezxn.supabase.co` |
| Compiled Stripe public key mode | Test | Live |
| Backend status | Online, one running replica, no recent failures or pending changes reported | Online, one running replica, no recent failures or pending changes reported |
| Backend deployment | `6ecbf385926faa2ae16b986b1b34a931e6d70984` | `fdced56a6d0026cc9519cfb26ff51f8869d8c558` |
| Frontend GitHub deployment status | Successful Vercel deployment for `d20f478e5290307b889d60eb243fbaeb11d11718` | Successful Vercel deployment for `fdced56a6d0026cc9519cfb26ff51f8869d8c558` |
| Database | Separate healthy Supabase project in `ca-central-1` | Separate healthy Supabase project in `ca-central-1` |
| Alembic revision | `c4e9812ab760`, matching the checkout's single head | `c4e9812ab760`, matching the checkout's single head |
| API surface | 126 documented paths, including assignments, push registration and billing reviews | Same path count and required route presence |
| Signed-out access | `/api/me` returns 401 | `/api/me` returns 401 |
| Browser API access | CORS preflight accepts the matching staging website | CORS preflight accepts the matching production website |
| Email confirmation | Email autoconfirm disabled | Email autoconfirm disabled |
| Public route serving | Login, password recovery, Privacy, Terms and DPA return 200 | Same; HTTP success does not finalize draft legal content or verify email delivery |
| Public database table RLS | All public tables have RLS enabled | All public tables have RLS enabled |
| Credential storage | Private `compliance-documents` bucket, 10 MiB limit and PDF/JPEG/PNG/HEIC types | Same |

This table records the initial inspection baseline. Subsequent staging billing acceptance deployed backend fixes through `c680d15` and the frontend card-refresh fix `d2c6979`; the linked billing report records their validation. Production remains at the inspected release. Promote through the existing staging-to-main pull-request workflow after acceptance, rather than using the stale local `main` checkout.

Vercel project/deployment detail requests returned 403 for the connected team, and no Vercel CLI was available. GitHub deployment statuses and the actual served bundles supplied the frontend evidence above. Vercel environment-variable settings, domain-to-deployment details, and protection settings still need an authorized provider inspection.

## Billing findings

Both deployed startup logs report the expected Stripe account, correct test/live mode, valid current monthly/annual/founding base prices, valid additional-client prices, no configuration-check errors, and a configured webhook secret. These checks use the credentials injected into the running backend; they are stronger evidence than local environment files.

Both Stripe webhook endpoints are enabled and subscribe to all ten events handled by the application: `checkout.session.completed`, the three subscription lifecycle events, and `invoice.created`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_succeeded`, `invoice.voided`, and `invoice.marked_uncollectible`. The older audit's missing-event finding is resolved.

At initial inspection staging had eight completed test-mode webhook receipts and one billing agreement. Subsequent acceptance exercised checkout, bank authentication, failed-payment recovery, plan changes, cancellation, notices, duplicate delivery and restart recovery using disposable staging records. Production had no webhook receipts or billing agreements at inspection; production signature/delivery verification remains open.

Railway exposes variable names through this connection, not their values:

- Staging now explicitly enables onboarding, usage finalization, settlement and billing notifications. Live settlement remains disabled and usage tax mode is `none`. The initial missing-variable finding is resolved; details and acceptance boundaries are in the staging billing report.
- Production defines those switches and `BILLING_SETTLEMENT_LIVE_ENABLED`; their current values cannot be confirmed through this connection. The latest repository setup notes specify live settlement disabled. Treat that as recorded configuration intent until runtime values are independently confirmed.
- Both environments retain three retired versioned base-price variable names alongside the current names. The current backend ignores the retired names. Cleanup is housekeeping, not evidence of a billing failure, and must consider rollback compatibility.

## Mobile and push findings

At initial inspection neither Railway environment defined `PUSH_DELIVERY_ENABLED` or `PUSH_ALLOWED_APP_IDS`. Staging preparation now enables delivery only for `com.homecareapp.worker.staging`; deployment `67e9593a-72a9-4ab7-a535-bf8246701532` is healthy. The existing staging FCM v1 credential and signing key were verified, and missing EAS preview website/Firebase-file settings were added. A current standalone APK is queued in Expo. Production was not changed. See [Android acceptance preparation](staging-android-acceptance-2026-10-15.md) for evidence and pending phone checks.

Use `com.homecareapp.worker.staging` for staging and `com.homecareapp.worker` for production. The repository maps EAS preview to staging and EAS production to production. Staging cloud settings and build history have now been inspected. Production cloud-mobile settings, Play access and physical-phone delivery remain unverified.

## Security and operating checks

- Supabase reports leaked-password protection disabled in both environments. Review availability and enable the appropriate protection before release. [Supabase password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Staging additionally reports email OTP expiry longer than one hour. Align the intended expiry policy and test invitation, confirmation and recovery flows. [Supabase production security guidance](https://supabase.com/docs/guides/platform/going-into-prod#security).
- Both environments report public and authenticated execute grants on `public.rls_auto_enable()`. Inspection confirms it returns `event_trigger`, uses `SECURITY DEFINER`, and fixes `search_path` to `pg_catalog`. This is not evidence that an ordinary RPC can execute it or expose patient records. Review unnecessary execute grants without disabling automatic RLS. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- The 43 informational RLS-without-policy findings match the backend-only data-access architecture. Do not add permissive frontend policies to silence them.
- Both website responses include HSTS but no Content-Security-Policy, frame restriction, X-Content-Type-Options or Referrer-Policy headers. Prepare appropriate headers and test embedded Stripe, Auth and uploads on staging before release.
- Backup/restore evidence, incident response, monitoring alert delivery, final legal documents and support/privacy operations remain open. A configured Sentry variable does not establish working monitoring.

## Work sequence and acceptance gates

### 1 Complete staging setup

- [x] Configure staging test-mode billing switches and tax mode after inspecting existing agreements and queued work. Deployment startup price/account validation passed.
- [ ] Configure staging Firebase/FCM and EAS preview values, validate the registered test device, and configure the staging push app allowlist and dispatch.
- [x] Verify canonical staging signup, invitation and recovery email delivery and browser callbacks. Immutable preview callbacks fall back to the canonical staging site; use the canonical site for authentication acceptance. Production settings and exhaustive allowlist inspection remain separate.
- [ ] Address the authentication and response-header findings above; assess the event-trigger grants separately.
- [ ] Restore Vercel project inspection access and inspect EAS cloud settings and build history.

### 2 Prove the complete staging MVP

- [x] Use clearly fictional agency, admin, worker and client records to test registration and email confirmation, worker invitation, client intake, funding, weekly care revisions, care requests and approval. See the agency and browser-authentication reports for evidence and boundaries.
- [x] Verify recurring scheduling, conflicts/overtime, partial coverage, assignment termination/replacement, Action Tower updates, notes and filtered timesheet export.
- [x] Verify concurrent approvals against PostgreSQL, stale-review rejection, agency isolation and retained history.
- [x] Exercise staging billing in test mode: deployed embedded purchase, bank authentication and recovery, plan changes, cancellation, renewals, usage collection, refunds, signed delivery and restart recovery. Fictional hosted visits also passed counting, simulated cutoff/finalization and annual accrual. See exact coverage and timing limitations in the [staging billing report](staging-billing-acceptance-2026-10-15.md). Production tax and live rollout remain separate gates.
- [ ] Test the signed staging Android build: login, welcome/skip, schedules, clients, note save/reopen and failed-save draft retention, credentials, inbox and recovery.
- [ ] Test push for assignments and schedule changes/cancellations with the app open, backgrounded and closed; verify taps, denied permission, sign-out/account switching and invalid tokens.
- [ ] Record pass/fail results, tested commits, build identifiers and remaining defects. Existing unit tests and intercepted browser fixtures do not complete these gates.

### 3 Prepare and release production

- [ ] Finalize Privacy, Terms, DPA, public contacts, retention/request handling and the promised manual customer onboarding/import process.
- [ ] Verify backup restoration and operational alerting, production Auth/SMTP settings, billing flags/tax mode, cloud mobile settings and production notification credentials.
- [ ] Promote the accepted staging changes through a staging-to-main PR; verify successful frontend/backend deployments and the expected database head.
- [ ] Verify live Stripe webhook signature/delivery and effective rollout settings before enabling live collection. No real charge is required merely to inspect configuration.
- [ ] Perform controlled production smoke checks and verify the signed production Android build against production services with designated fictional records.
- [ ] Complete Play developer access, declarations, assets, reviewer access, applicable testing and submission for review.

## Evidence references

- [Staging frontend deployment](https://vercel.com/fumezs-projects/homecare-app/8NHNcU66XvJbV9yJGyB75JTgJwug)
- [Production frontend deployment](https://vercel.com/fumezs-projects/homecare-app/3oTz1TbMYzj8f5CnV3HqC29eV6YL)
- [Railway project](https://railway.com/project/ad7d0852-3a98-45b7-bc0d-01068f7d3f95)
- [Current billing configuration](../backend/BILLING_CONFIGURATION.md)
- [Worker push rollout](../backend/WORKER_PUSH.md)
- [Android release checklist](../worker-mobile-app/GOOGLE_PLAY_RELEASE.md)
- [Assignment rollout tests](../backend/ASSIGNMENTS.md)

GitHub's current staging frontend build/lint/type checks and production frontend/backend checks are green. These are the checks present for those commits; path-filtered workflows do not rerun every application on each push. Mobile device acceptance remains separate.
