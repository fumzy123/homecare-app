# Worker phone notifications

Implemented 2026-10-03. Deployment and physical Android delivery are not yet verified.

## Architecture

Existing shift/placement routers call their services. `ShiftService` enlists
`WorkerNotificationService` for individual inbox records and per-device delivery
rows in the same transaction. Coverage approval enqueues the selected workers'
existing `placement_filled` notices; ending old coverage also notifies its workers.
No notification is sent from a router or repository, and preview/failed approvals
do not publish notifications. There is no external queue dependency.

`deliver_worker_pushes` runs every 30 seconds using APScheduler and its own session.
`PushDeliveryService` owns delivery transactions; `PushDeliveryRepository` owns
queries. Rows are locked with `FOR UPDATE SKIP LOCKED`. `ExpoPushClient` handles
only HTTP. Pure lock-screen content and change projections live in `domain/push.py`.
The repository's existing single-scheduler-process restriction still applies.

Events: direct assignment, reassignment (old worker removed/new worker assigned),
series edits, per-occurrence edits/cancellation, whole-series cancellation,
cancel-from-date, split-series edits, care-request approval and replaced coverage.
Ordinary completion status changes do not send schedule alerts. No-op master and
occurrence updates do not enqueue another alert. The inbox works without a phone.

## Deployment

1. Apply Alembic migration `de9e97b23461` **before** deploying this application code.
   It adds inbox enum values and the private `push_deliveries` table. The migration
   enables RLS and revokes PUBLIC/anon/authenticated access; no client policies exist.
2. Configure Android FCM v1 sending credentials in EAS for the matching Firebase
   project. These service-account credentials never belong in the mobile app.
3. Set `PUSH_ALLOWED_APP_IDS=["com.homecareapp.worker.staging"]` on staging.
   Production must use `["com.homecareapp.worker"]` and production credentials.
   No allowed apps means no dispatch. An app ID is a delivery environment filter,
   not a replacement for authenticated worker registration.
4. If Expo enhanced push security is enabled, put its access token in the backend's
   `EXPO_PUSH_ACCESS_TOKEN`. Never use an EXPO_PUBLIC variable for that token.
5. After testing credentials and migration, set `PUSH_DELIVERY_ENABLED=true`.
   This starts external delivery. It defaults to false; the inbox remains active.
   Only queued events less than 24 hours old are eligible when enabling delivery.

## Reliability and privacy

The sender checks active worker/agency membership, current device owner, token,
and app ID immediately before sending. Logout/reassignment/token rotation causes
stale queued work to be skipped. Device registration is locked during the bounded
HTTP handoff. Once handed to Expo, a message cannot be recalled; its text and data
therefore contain no patient names, care instructions, addresses or visit details.
Data carries only an opaque notification ID. The app opens its authenticated inbox
and schedule, with existing backend authorization applied on every record request.

Network/429/5xx failures retry at 1/2/4/8-minute intervals, at most five send attempts.
After Expo accepts a ticket, receipts are checked after 15 minutes and every 15
minutes thereafter until the 24-hour deadline. A missing receipt never causes a
resend. `DeviceNotRegistered` revokes only the matching current token. Terminal
rows clear their token snapshot. Provider bodies/tokens are not logged.

`delivered` means Expo reports acceptance by FCM, **not** proof that Android
displayed the notification or the worker read it. HTTP timeouts or a crash after
handoff but before commit can cause a duplicate on retry; this is at-least-once
delivery, not exactly-once. A stable collapse ID reduces pending duplicate displays.
Persisted failure codes such as InvalidCredentials/MismatchSenderId need operator
attention in backend-only `push_deliveries`; new events should be tested after
credentials are corrected. This change adds no public delivery-administration API.

## Validation and release gate

Backend tests cover transactional rollback, private payloads, active employment,
agency isolation, environment selection, token revocation/rotation/reassignment,
tickets, receipts, bounded retries and expiry using fictional records and a fake
Expo HTTP transport. Mobile tests cover permission/registration lifecycle,
foreground updates, cold/background taps, stale-account callbacks and EAS file
configuration. SQLite tests do not prove PostgreSQL concurrent locking behavior.

Before release, apply the migration to staging and verify with a signed Android
development/release build: assignment, reschedule, cancellation, care approval,
foreground/background/closed-app taps, denied permission, logout/account switch,
network interruption, expired/invalid tokens and receipt handling. Use fictional
records. Verify PostgreSQL concurrent job claims on staging before scaling.
