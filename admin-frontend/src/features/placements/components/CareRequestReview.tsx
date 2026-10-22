import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { WEEKDAYS, WEEKDAY_LABELS } from '@/features/weekly-care-need/constants'
import { weeklyHours } from '@/features/clients/lib/care'
import { fmtHours } from '@/features/weekly-care-need/utils'
import type { ApprovalReview, PlacementDetail, ApprovalPayload } from '../api'
import { requestDate } from '../lib/careRequests'
import { WorkerSchedulingChecks } from './WorkerSchedulingChecks'

// Layer 2: shows the server's review, never invents eligibility results.
export function CareRequestReview({
  request: p,
  preview,
  selections,
  busy,
  acceptGaps,
  stale,
  error,
  onAcceptGaps,
  confirmArranged,
  onConfirmArranged,
  onBack,
  onApprove,
}: {
  request: PlacementDetail
  preview: ApprovalReview
  selections: ApprovalPayload['selections']
  busy: boolean
  acceptGaps: boolean
  stale: boolean
  error: string
  onAcceptGaps: (value: boolean) => void
  confirmArranged: boolean
  onConfirmArranged: (value: boolean) => void
  onBack: () => void
  onApprove: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
    heading.current?.scrollIntoView({ block: 'start' })
  }, [])
  return (
    <section className="cr-review" aria-label="Schedule change review">
      <button className="cr-link cr-back" disabled={busy} onClick={onBack}>
        <ArrowLeft size={16} /> Back to coverage
      </button>
      <p className="cr-label">
        {p.client_first_name} {p.client_last_name} / Approval
      </p>
      <h1 ref={heading} tabIndex={-1}>
        Review the <em>change.</em>
      </h1>
      <p className="cr-muted">
        Coverage starts {requestDate(preview.starts_on)}
      </p>
      <div className="cr-review-box">
        <p className="cr-label">New recurring coverage</p>
        <p className="cr-small mt-2">
          Only the care slots being added in this approval are shown.
        </p>
        <div
          className="cr-review-week-scroll"
          role="region"
          aria-label="New recurring coverage by weekday"
          tabIndex={0}
        >
          <div className="cr-review-week">
            {WEEKDAYS.map((day) => {
              const slots = p.care_slots
                .filter(
                  (slot) =>
                    slot.day_of_week === day.key &&
                    selections.some((s) => s.care_slot_id === slot.id),
                )
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
              return (
                <section
                  className="cr-review-day"
                  aria-label={`${day.label} new coverage`}
                  key={day.key}
                >
                  <h2 className="cr-label">{day.label}</h2>
                  {slots.length ? (
                    slots.map((slot) => {
                      const selection = selections.find(
                        (s) => s.care_slot_id === slot.id,
                      )!
                      const worker = preview.workers.find(
                        (w) => w.worker_id === selection.employment_id,
                      )
                      return (
                        <div className="cr-review-care-slot" key={slot.id}>
                          <p className="cr-review-slot-time">
                            {slot.start_time.slice(0, 5)}–
                            {slot.end_time.slice(0, 5)}
                          </p>
                          <p>{worker?.worker_name || 'Worker unavailable'}</p>
                          <p className="cr-small">
                            {fmtHours(weeklyHours([slot]))}h
                          </p>
                          {selection.assignment_source === 'admin_arranged' && (
                            <p className="cr-small">Arranged by admin</p>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <p className="cr-small mt-5">No new coverage</p>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      </div>
      {selections.some((s) => s.assignment_source === 'admin_arranged') && (
        <label className="cr-check cr-review-box">
          <input
            type="checkbox"
            checked={confirmArranged}
            disabled={busy}
            onChange={(e) => onConfirmArranged(e.target.checked)}
          />
          I have arranged this coverage with the directly selected workers. This
          records my confirmation, not an expression of worker interest.
        </label>
      )}
      {preview.ends_previous_schedule && preview.old_shifts.length > 0 && (
        <div className="cr-callout">
          <h3>The previous schedule ends.</h3>
          <p className="mt-3">
            From {requestDate(preview.starts_on)}, the previous revision’s
            recurring visits stop. They will not cover unfilled Care Slots in
            this revision. Earlier visits remain in history.
          </p>
          <details className="mt-4">
            <summary>See affected coverage</summary>
            <ul className="mt-3">
              {preview.old_shifts.map((s) => (
                <li key={s.shift_id}>
                  {s.worker_name} · {s.description}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
      <div className="cr-review-box">
        <p className="cr-label">Eligibility checks</p>
        {preview.workers.map((w) => (
          <WorkerSchedulingChecks key={w.worker_id} worker={w} />
        ))}
        {!preview.all_clear && (
          <p className="cr-error">
            Resolve the reported issues before approving this coverage.
          </p>
        )}
      </div>
      {preview.uncovered_slots.length > 0 && (
        <div className="cr-review-box">
          <h3>
            {preview.uncovered_slots.length} Care Slot
            {preview.uncovered_slots.length === 1
              ? ' remains'
              : 's remain'}{' '}
            open.
          </h3>
          {preview.uncovered_slots.map((slot) => (
            <div className="cr-review-row" key={slot.id}>
              <span>
                {WEEKDAY_LABELS[slot.day_of_week]} ·{' '}
                {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
              </span>
            </div>
          ))}
          <label className="cr-check">
            <input
              type="checkbox"
              checked={acceptGaps}
              disabled={busy}
              onChange={(e) => onAcceptGaps(e.target.checked)}
            />
            I understand these Care Slots remain uncovered and open for worker
            interest.
          </label>
        </div>
      )}
      {stale && (
        <p role="alert" className="cr-error">
          This request changed. Go back and review the latest coverage before
          approving.
        </p>
      )}
      {error && (
        <p role="alert" className="cr-error">
          {error}
        </p>
      )}
      <div className="cr-between cr-review-footer">
        <p className="cr-small">
          Eligibility is checked again at confirmation.
        </p>
        <button
          className="cr-button cr-primary"
          disabled={
            busy ||
            stale ||
            !preview.all_clear ||
            (selections.some((s) => s.assignment_source === 'admin_arranged') &&
              !confirmArranged) ||
            (preview.uncovered_slots.length > 0 && !acceptGaps)
          }
          onClick={onApprove}
        >
          {busy ? 'Scheduling…' : 'Approve and schedule'}{' '}
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  )
}
