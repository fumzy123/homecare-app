import { Check, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ApprovalReview } from '../api'
import { requestDate } from '../lib/careRequests'

function CheckExplanation({ label, passed, reasons, children }: {
  label: string
  passed: boolean
  reasons: string[]
  children: ReactNode
}) {
  return (
    <div className={passed ? 'cr-check-result' : 'cr-check-result cr-check-failed'}>
      <dt>
        {label}
        <span className="cr-check-status">
          {passed ? <Check size={15} aria-hidden="true" /> : <TriangleAlert size={15} aria-hidden="true" />}
          {passed ? 'Passed' : 'Needs attention'}
        </span>
      </dt>
      <dd>
        {reasons.length > 0 && <ul className="cr-check-reasons">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
        {children}
      </dd>
    </div>
  )
}

// Layer 2: explain the server's checks; never recalculate eligibility in the UI.
export function WorkerSchedulingChecks({
  worker: w,
}: {
  worker: ApprovalReview['workers'][number]
}) {
  const maximum = w.hours?.max_weekly_hours
  const hasMaximum = maximum != null && maximum > 0
  const failedChecks = [!w.eligibility.availability_ok, !w.eligibility.no_conflicts, !w.eligibility.within_hours].filter(Boolean).length
  const details = w.eligibility.check_details
  // Older responses have only a combined list; attach it when exactly one check failed.
  const reasonsFor = (check: 'availability' | 'conflicts' | 'hours', passed: boolean) =>
    passed ? [] : details?.[check]?.length ? details[check] : failedChecks === 1 ? w.eligibility.reasons : []
  const availabilityReasons = reasonsFor('availability', w.eligibility.availability_ok)
  const conflictReasons = reasonsFor('conflicts', w.eligibility.no_conflicts)
  const hoursReasons = reasonsFor('hours', w.eligibility.within_hours)
  const ungroupedReasons = failedChecks > 1 && !details ? w.eligibility.reasons : []
  return (
    <section
      className="cr-worker-checks"
      aria-label={`Scheduling checks for ${w.worker_name}`}
    >
      <div className="cr-between">
        <h3>{w.worker_name}</h3>
        <span className={`cr-row cr-small ${w.eligibility.all_clear ? "" : "cr-check-overall-failed"}`}>
          {w.eligibility.all_clear ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <TriangleAlert size={16} aria-hidden="true" />
          )}
          {w.eligibility.all_clear ? 'Checks passed' : 'Needs review'}
        </span>
      </div>
      <dl className="cr-check-explanations">
        <CheckExplanation label="Worker availability" passed={w.eligibility.availability_ok} reasons={availabilityReasons}>
            {w.eligibility.availability_ok
              ? `The selected care slots fit ${w.worker_name}’s recorded availability.`
              : !availabilityReasons.length && `The selected care slots are not fully covered by ${w.worker_name}’s recorded availability.`}
        </CheckExplanation>
        <CheckExplanation label="Visit conflicts" passed={w.eligibility.no_conflicts} reasons={conflictReasons}>
            {w.eligibility.no_conflicts
              ? 'No overlapping visits were found in this worker’s schedule.'
              : !conflictReasons.length && 'This worker already has a visit that overlaps the selected care.'}
        </CheckExplanation>
        <CheckExplanation label="Weekly hours" passed={w.eligibility.within_hours} reasons={hoursReasons}>
            <p>
              {w.eligibility.within_hours
                ? hasMaximum
                  ? `The selected care keeps this worker within their maximum of ${maximum} hours per week and passes the overtime check.`
                  : maximum !== undefined
                    ? 'No personal weekly maximum is set. The selected care passes the overtime check.'
                    : 'The selected care passes the worker’s weekly-hours and overtime checks.'
                : !hoursReasons.length && 'The selected care exceeds a weekly-hours limit.'}
            </p>
            {!w.eligibility.within_hours && hasMaximum && (
              <p className="cr-small mt-2">
                Worker’s maximum: {maximum} hours per week.
              </p>
            )}
            {w.hours && (
              <details className="cr-hours-detail">
                <summary>View first-week hours</summary>
                <p className="cr-small mt-3">
                  {requestDate(w.hours.week_start)}–
                  {requestDate(w.hours.week_end)}: the week containing this
                  worker’s first new visit. These dates group hours for the
                  weekly limit check.
                </p>
                <dl className="cr-hours-totals">
                  <div>
                    <dt>Already scheduled across clients</dt>
                    <dd>{w.hours.current}h</dd>
                  </div>
                  <div>
                    <dt>Added by this approval</dt>
                    <dd>+ {w.hours.proposed}h</dd>
                  </div>
                  <div>
                    <dt>Total after approval</dt>
                    <dd>{w.hours.total}h</dd>
                  </div>
                </dl>
                <p className="cr-small">
                  This is the first-week breakdown; the scheduling checks also
                  assess later recurring visits.
                </p>
              </details>
            )}
        </CheckExplanation>
      </dl>
      {ungroupedReasons.map((reason) => (
        <p className="cr-error" key={reason}>
          {reason}
        </p>
      ))}
    </section>
  )
}
