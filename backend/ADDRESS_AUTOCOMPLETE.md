# Canadian address autocomplete

Client intake and profile editing share the Street address lookup. It waits for
three trimmed characters and a 350 ms pause. Selecting a suggestion fills street,
city, province and postal code; all remain editable. Add apartment/unit details
to Street address manually. Suggestions are not address validation or proof of
deliverability. Missing provider components remain blank for manual completion.

Suggestions display a location icon, bold street and a secondary locality line;
required attribution remains compact. New-client closing uses a Care Harbor
Discard changes / Keep editing dialog only when current values differ from the
initial form. Keeping edits or pressing Escape retains the draft and restores
focus. Untouched or fully reverted forms close immediately. The browser suite
also verifies these close/keep/discard paths without native confirmation popups.

The frontend calls authenticated `POST /api/addresses/autocomplete` with only
`{"text": "typed address"}`. It never sends the client ID, name, care notes or
other form fields. POST avoids putting the search in ordinary backend access-log
URLs. The backend calls Geoapify with a Canada filter, English results and a limit
of five. It returns only display/address fields; coordinates are not stored. The
UI credits Geoapify and OpenStreetMap. A future map is a separate feature.

## Configuration and usage

Set `GEOAPIFY_API_KEY` in backend `.env.local`; restart the backend after changing
environment configuration. Hosted staging/production need their own backend
environment variables and preferably separate provider keys. No frontend key,
dependency, database migration or third-party widget is needed.

### Hosted deployment verification

Railway staging waits for GitHub checks before deploying and watches `/backend/**`.
A failed check can leave the previous backend serving traffic even when Vercel has
published the newer frontend. Inspect Railway's actual deployment status and commit;
a GitHub status reported as successful does not prove a skipped deployment went live.
After fixing a blocked release, ensure the latest staging commit is deployed, then
check that `/openapi.json` includes `POST /api/addresses/autocomplete`. An anonymous
request should be rejected by authentication, not return a missing-route 404.
Finally, test suggestions while signed in; presence of the route alone does not
verify the provider key or field population.

- An absent key, timeout, provider failure, quota limit or empty result leaves
  manual address entry usable and never blocks client saving.
- The service has an eight-second HTTP timeout and ten-second total lookup limit.
- No automatic retries or focus/reconnect refetches. The browser reuses identical
  successful searches for five minutes in memory; it does not persist a cache.
- Changing the query cancels the previous browser request and hides its results
  immediately. Cancellation cannot undo a provider call already sent (it may still
  cost a credit).
- A lock-protected budget allows four upstream calls per rolling second, 30 per
  account per rolling minute, and `ADDRESS_LOOKUP_DAILY_LIMIT` calls per rolling
  24 hours across accounts (default 2,500, configurable 0–3,000). Attempts count
  even when the provider fails; zero disables calls.
- **These counters are in memory in one backend process and reset on restart.**
  They are not a guaranteed provider spending cap. Before enabling multiple
  replicas/workers or sharing a key across deployments, use shared persistent
  counters and budget for other uses of the key. Monitor provider usage.
- Provider errors are translated without exposing the URL/key. Outgoing Sentry
  events/transactions scrub Geoapify URLs and query strings. Do not enable raw
  HTTP request logging in deployed environments.

## Verification

- Backend: `.venv/Scripts/python.exe -X utf8 -m pytest tests/services/test_address_autocomplete.py -q -p no:cacheprovider`
- Frontend: `node node_modules/vitest/vitest.mjs run tests/address-autocomplete.test.jsx`
- Frontend: `npm run build`
- Browser: `node tests/address-autocomplete.browser.cjs`, with isolated Vite on
  `http://127.0.0.1:5198`, dummy Supabase/backend/Stripe public configuration and
  `PLAYWRIGHT_MODULE` if using an external Playwright installation. All browser
  account and API data is intercepted and fictional.

Tests cover minimum length/debounce, stale response cancellation, keyboard/mouse
selection, intake/edit field population and saved payload, manual unit editing,
missing/incomplete/no-match results, failure fallback, auth, request validation,
budgets, telemetry redaction and narrow-screen layout. No existing clients were
sent to Geoapify for testing. Local provider smoke checks used public street names.
