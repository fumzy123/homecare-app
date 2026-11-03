# Mobile staging sign-in recovery — November 3, 2026

The user reported an intermittent first sign-in failure, later said it was working,
and clarified that the button stayed **Sign In**. An earlier message said it stayed
**Signing in…**. No device trace establishes which path caused the incident.

## Reproduced defects and changes

- With the real TanStack Form and rendered LoginForm, submit invalid values, correct
  them, then submit again without another blur: no authentication call was made.
  Blur-only validation left stale errors and blocked `handleSubmit`. Corrections now
  revalidate after blur or submission, preserving initial blur/submission feedback.
- Emails containing surrounding whitespace failed validation before reaching the
  existing submission trim. Normalize before validation too; passwords stay exact.
- A never-settling password HTTP request had no application deadline. A custom
  Supabase fetch bounds only password token exchange to 20 seconds, including body
  consumption, aborts native fetch, and rejects before the SDK can save the result.
  Tests use the installed Supabase SDK to verify a late success cannot overwrite a
  successful retry or emit a second SIGNED_IN event. Other auth requests pass through.
- The form awaits its mutation, retains credentials/errors for retry, disables field
  editing while pending, and exposes failures as alerts. The mutation has no automatic
  retry or reconnect submission. The keyboard tap configuration is unchanged because
  an actual first-tap responder failure was not reproduced.

The deadline applies to password networking, not every native storage/auth operation.
No backend, database, credential or production configuration changes are required.

## Validation

All 95 mobile script tests and TypeScript passed locally. `npm run test:sign-in`
contains 12 cases: first press with/without blur, corrected validation, trimmed email,
unchanged password, retry preserving input, stalled headers/body, cancellation,
provider errors, late responses and non-password pass-through. It runs in Mobile CI.
Tests mock native UI/transport; phone keyboard, autofill, sign-out → sign-in, and
slow-network acceptance remain required on the new APK.

Build submission and CI evidence will be recorded after publishing the source commit.
