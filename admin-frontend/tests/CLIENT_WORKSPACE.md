# Client workspace checks

The app routes are under `/dashboard/clients`; the client index is Overview.
Funding is now a separate route. Old care-need links with an authorization query
redirect to the matching Funding record.

Run `node --experimental-strip-types --test tests/client-care.test.mjs` for the
care/funding calculations, and the normal TypeScript, ESLint and production build.
Backend coverage is in `tests/services/test_client_workspace.py` plus the existing
weekly-care save, placement assignment and worker note tests.

For a local browser walkthrough, start Vite and open `/tests/client-workspace.html`.
This host imports the real production components with fictional, in-memory API
responses. Its adapter rejects unhandled requests. It is not imported by the app,
does not bypass the app's sign-in, and is not included in the production build.
Reloading resets its sample records. It verifies rendering and client-side
interactions; use a signed-in test agency for database-backed acceptance testing.

Verified with the host:
- Directory and three-step client creation; saved client appears in the table.
- Profile validation, saving and return to Overview.
- Current and proposed care, revision creation, history, and posting without visits.
- Funding stays on the current revision after a proposed revision is saved.
- Service dropdown additions and authorization amendment/history.
- Visit List/Week views, status filters, totals, details and note follow-ups.
- Monthly notes and worker filtering.
- Desktop, tablet and narrow layouts; active-tab state and native dialog focus.

The main app still uses its authenticated backend. No staging database changes,
credentials, schema migrations or deployment are required by the UI files alone.
Deploy the updated backend with the frontend for the current-care response and
append-note endpoint.
