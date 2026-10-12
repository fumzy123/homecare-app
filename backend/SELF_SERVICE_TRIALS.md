# Automatic app trial and visible usage (2026-09-29)

This supersedes onboarding timing in BILLING_ONBOARDING.md and
SELF_SERVICE_BILLING.md. Agency creation after email confirmation starts a
14-day application trial. Registration does not create a Stripe subscription.
The owner selects a plan, accepts current consent, and completes card setup to
authorize automatic subscription creation with the remaining trial preserved.
Expired trials purchase without retroactive usage charges.

Onboarding no longer provides access or controls trial dates. The operator trial
endpoint returns 410 without writes, and its button is removed. The maintenance
job only recovers already authorized purchases; it no longer starts trials at a
30-day deadline. Existing confirmed Stripe subscription dates are preserved.
Unsubscribed local accounts use agency creation plus 14 days even if they still
contain an old onboarding deadline. No database migration or remote subscription
mutation was performed for this change.

The existing onboarding_deadline_at column is retained as the billing-rollout
marker required by period recovery and settlement. New agencies populate it with
their creation timestamp. It is no longer used to delay the free trial. Renaming
this schema and legacy internal endpoints is a separate compatibility cleanup.

Billing highlights current-period additional usage, client counts and its
finalization deadline. Earlier finalized, uninvoiced usage is displayed alongside
the estimate. Unresolved history or pending corrections suppress an aggregate
total rather than imply a complete amount. The invoice table no longer includes
the remaining-balance column; invoice status and document links remain.

Implemented: CAD 350/3,360 Standard version 2, annual usage accumulation, combined
renewal settlement, and in-app annual reminders. See BILLING_V2.md for collection
timing, verification and environment configuration. Version 1 records retain their
historical terms; new purchases use version 2. No existing paid agreement is silently
repriced. Approved corrections to unbilled annual usage are included in its displayed
balance and annual invoice. Trial usage has a zero-charge preview.
