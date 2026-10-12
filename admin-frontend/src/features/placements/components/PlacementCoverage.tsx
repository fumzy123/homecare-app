import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import {
  usePlacement,
  useApproveCareSlots,
  useClosePlacement,
} from '../hooks/usePlacements'
import { useCareNeedVersions } from '@/features/weekly-care-need/hooks/useWeeklyCareNeed'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import { ClientDialog } from '@/features/clients/components/ClientWorkspaceUI'
import { errorMessage, weeklyHours } from '@/features/clients/lib/care'
import { useAgencyDate } from '../hooks/useAgencyDate'
import {
  requestDate,
  selectWorkerSlots,
  validSelections,
  sortCareSlots,
} from '../lib/careRequests'
import { RequestStatus } from './CareRequestUI'
import { CareRequestSlots, CareRequestWorkers } from './CareRequestWork'
import { CareRequestReview } from './CareRequestReview'
import type { ApprovalReview } from '../api'

// Layer 3: owns the live request, draft selections and server-reviewed approval.
export function PlacementCoverage({
  placementId,
  embedded = false,
}: {
  placementId: string
  embedded?: boolean
}) {
  const query = usePlacement(placementId)
  const versions = useCareNeedVersions(query.data?.client_id ?? '')
  const { review, approve } = useApproveCareSlots(placementId)
  const close = useClosePlacement()
  const today = useAgencyDate()
  const [tab, setTab] = useState<'coverage' | 'interest'>('coverage')
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [startsOn, setStartsOn] = useState('')
  const [preview, setPreview] = useState<ApprovalReview | null>(null)
  const [reviewedState, setReviewedState] = useState('')
  const [acceptGaps, setAcceptGaps] = useState(false)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  const [success, setSuccess] = useState('')
  useUnsavedChanges(Object.values(selected).some(Boolean) && !approve.isPending)
  if (query.isPending)
    return (
      <p role="status" className="cr-page">
        Loading care request…
      </p>
    )
  if (query.isError || !query.data)
    return (
      <div role="alert" className="cr-page">
        Could not load care request.{' '}
        <button className="cr-link" onClick={() => void query.refetch()}>
          Retry
        </button>
      </div>
    )
  const p = { ...query.data, care_slots: sortCareSlots(query.data.care_slots) }
  const revision = versions.data?.find((v) => v.id === p.weekly_care_need_id)
  const earliestDate = [today, p.start_date ?? '', p.scheduled_from ?? '',
    ...p.care_slots.filter(s => selected[s.id] && !s.worker_id).map(s => s.replacement_from || '')]
    .sort()
    .at(-1)!
  const effectiveDate = startsOn || earliestDate
  const selections = validSelections(p, selected)
  const selectedSlots = p.care_slots.filter((s) =>
    selections.some((v) => v.care_slot_id === s.id),
  )
  const open = p.care_slots.filter((s) => !s.worker_id)
  const busy = review.isPending || approve.isPending || close.isPending
  const requestState = JSON.stringify([
    p.status,
    p.care_slots,
    p.interests,
    p.scheduled_from,
  ])
  function resetReview() {
    setPreview(null)
    setAcceptGaps(false)
    setError('')
    setSuccess('')
  }
  async function handleReview() {
    setError('')
    try {
      const result = await review.mutateAsync({
        selections,
        starts_on: effectiveDate,
      })
      setPreview(result)
      setReviewedState(requestState)
      setAcceptGaps(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  async function handleApproval() {
    if (!preview || reviewedState !== requestState) return
    setError('')
    try {
      await approve.mutateAsync({
        selections,
        starts_on: effectiveDate,
        review_token: preview.review_token,
        accept_uncovered: acceptGaps,
      })
      setSelected({})
      setPreview(null)
      setAcceptGaps(false)
      setSuccess('Coverage approved and visits scheduled.')
    } catch (err) {
      setError(errorMessage(err))
      setPreview(null)
    }
  }
  const canApprove =
    p.status === 'open' && !!p.weekly_care_need_id && p.care_slots.length > 0
  return (
    <div className={`care-requests ${embedded ? 'p-4' : 'cr-page'}`}>
      {preview ? (
        <CareRequestReview
          request={p}
          preview={preview}
          selections={selections}
          busy={busy}
          acceptGaps={acceptGaps}
          stale={reviewedState !== requestState}
          error={error}
          onAcceptGaps={setAcceptGaps}
          onBack={resetReview}
          onApprove={() => void handleApproval()}
        />
      ) : (
        <>
          {!embedded && (
            <Link className="cr-link cr-back" to="/dashboard/placements">
              <ArrowLeft size={17} /> All care requests
            </Link>
          )}
          <header className="cr-header cr-between">
            <div>
              <div className="cr-row">
                <p className="cr-label">
                  Care request
                  {revision
                    ? ` / Revision ${revision.version}`
                    : !p.weekly_care_need_id
                      ? ' / Legacy record'
                      : ''}
                </p>
                <RequestStatus request={p} />
              </div>
              <h1>
                {p.client_first_name} {p.client_last_name}
              </h1>
              <p className="cr-muted">{p.masked_location}</p>
            </div>
            {p.status === 'open' && (
              <button
                className="cr-button"
                disabled={busy}
                onClick={() => {
                  setError('')
                  setClosing(true)
                }}
              >
                Close care request
              </button>
            )}
          </header>
          {p.weekly_care_need_id && versions.isError && (
            <p className="cr-error">
              Could not load the care revision.{' '}
              <button
                className="cr-link"
                onClick={() => void versions.refetch()}
              >
                Retry
              </button>
            </p>
          )}
          <div className="cr-facts">
            <span>
              Care request start date{' '}
              <strong className="font-normal">
                {requestDate(p.start_date)}
              </strong>
              {p.status === 'open' &&
                !p.scheduled_from &&
                p.start_date &&
                p.start_date <= today && (
                  <span className="cr-overdue"> · Start date reached</span>
                )}
            </span>
            {p.care_slots.length > 0 && (
              <span>{weeklyHours(p.care_slots)} hours / week</span>
            )}
          </div>
          <details className="cr-details">
            <summary>Request details</summary>
            <div className="cr-details-body">
              {p.requirements && (
                <div>
                  <p className="cr-label mb-2">Care & notes</p>
                  <p>{p.requirements}</p>
                </div>
              )}
              {!p.weekly_care_need_id && p.shift_description && (
                <p>{p.shift_description}</p>
              )}
              <div className="cr-small cr-posted">
                Posted {requestDate(p.created_at)}
                {p.scheduled_from && (
                  <p className="mt-2">
                    Scheduled from {requestDate(p.scheduled_from)}
                  </p>
                )}
              </div>
            </div>
          </details>
          {!p.weekly_care_need_id && (
            <p className="cr-callout">
              This earlier request has no revision-linked Care Slots.{' '}
              <Link
                className="cr-link"
                to="/dashboard/clients/$clientId/care-need"
                params={{ clientId: p.client_id }}
              >
                Post the client’s Weekly Care Need
              </Link>{' '}
              to use individual approvals.
            </p>
          )}
          {success && (
            <p role="status" className="cr-success">
              {success}
            </p>
          )}
          {error && !closing && (
            <p role="alert" className="cr-error">
              {error}
            </p>
          )}
          <div className="cr-tabs" aria-label="Care request sections">
            <button
              aria-pressed={tab === 'coverage'}
              onClick={() => setTab('coverage')}
            >
              Care coverage
            </button>
            <button
              aria-pressed={tab === 'interest'}
              onClick={() => setTab('interest')}
            >
              Interested workers · {p.interests.length}
            </button>
          </div>
          {tab === 'interest' ? (
            <CareRequestWorkers
              request={p}
              selected={selected}
              busy={busy}
              onSelect={(worker) => {
                setSelected((prev) => selectWorkerSlots(p, prev, worker))
                resetReview()
                setTab('coverage')
              }}
            />
          ) : (
            <div className="cr-layout">
              <CareRequestSlots
                request={p}
                selected={selected}
                busy={busy}
                onSelect={(slot, worker) => {
                  setSelected((prev) => ({ ...prev, [slot]: worker }))
                  resetReview()
                }}
              />
              <aside>
                <section className="cr-plan">
                  <div className="cr-plan-head">
                    <p className="cr-label">
                      {canApprove ? 'Your selection' : 'Scheduled coverage'}
                    </p>
                    <h3>
                      {canApprove
                        ? 'Coverage plan.'
                        : p.status === 'filled'
                          ? 'Coverage complete.'
                          : 'Care coverage.'}
                    </h3>
                  </div>
                  <div className="cr-plan-body">
                    {canApprove ? (
                      <>
                        <div>
                          <span className="cr-plan-value">
                            {selections.length}
                          </span>
                          <span className="cr-small">
                            {' '}
                            / {open.length} open Care Slots
                          </span>
                        </div>
                        <div className="cr-plan-line">
                          <span>Hours to schedule</span>
                          <span>{weeklyHours(selectedSlots)}h / week</span>
                        </div>
                        <div className="cr-plan-line">
                          <span>Still uncovered</span>
                          <span>
                            {open.length - selections.length} Care Slots
                          </span>
                        </div>
                        <label className="cr-field">
                          Coverage starts
                          <input
                            type="date"
                            min={earliestDate}
                            value={effectiveDate}
                            disabled={busy}
                            onChange={(e) => {
                              setStartsOn(e.target.value)
                              resetReview()
                            }}
                          />
                        </label>
                        <p className="cr-small">
                          Visits are created only after approval.
                        </p>
                        <button
                          className="cr-button cr-primary"
                          disabled={
                            busy ||
                            !selections.length ||
                            effectiveDate < earliestDate
                          }
                          onClick={() => void handleReview()}
                        >
                          {review.isPending ? 'Checking…' : 'Review approval'}{' '}
                          <ArrowRight size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="cr-plan-value">
                          {p.covered_count} / {p.care_slots.length}
                        </div>
                        <p className="cr-muted">Care Slots approved</p>
                        <div className="cr-plan-line">
                          <span>Scheduled weekly</span>
                          <span>
                            {weeklyHours(
                              p.care_slots.filter((s) => !!s.worker_id),
                            )}
                            h
                          </span>
                        </div>
                        <Link
                          className="cr-button"
                          to="/dashboard/clients/$clientId/visits"
                          params={{ clientId: p.client_id }}
                        >
                          View scheduled care <ArrowRight size={16} />
                        </Link>
                      </>
                    )}
                  </div>
                </section>
                <p className="cr-note">
                  {canApprove
                    ? 'Worker interest does not reserve a Care Slot. Checks run before approval.'
                    : 'Approved visits remain scheduled when a request closes.'}
                </p>
              </aside>
            </div>
          )}
        </>
      )}
      {closing && (
        <ClientDialog
          title="Close this care request?"
          onClose={() => {
            if (!close.isPending) setClosing(false)
          }}
        >
          <div className="care-requests cr-stack">
            <h3>
              {p.client_first_name} {p.client_last_name}
            </h3>
            <p>
              Workers can no longer express interest. Already approved visits
              remain scheduled.
            </p>
            {open.length > 0 && (
              <p>
                {open.length} Care Slot
                {open.length === 1 ? ' will remain' : 's will remain'}{' '}
                uncovered.
              </p>
            )}
            {error && (
              <p role="alert" className="cr-error">
                {error}
              </p>
            )}
            <div className="cr-between">
              <button
                className="cr-button"
                disabled={close.isPending}
                onClick={() => setClosing(false)}
              >
                Keep open
              </button>
              <button
                className="cr-button cr-primary"
                disabled={close.isPending}
                onClick={() =>
                  close.mutate(p.id, {
                    onSuccess: () => {
                      setClosing(false)
                      setSelected({})
                      setPreview(null)
                      setSuccess(
                        'Care request closed. Approved visits remain scheduled.',
                      )
                    },
                    onError: (err) => setError(errorMessage(err)),
                  })
                }
              >
                {close.isPending ? 'Closing…' : 'Close request'}
              </button>
            </div>
          </div>
        </ClientDialog>
      )}
    </div>
  )
}
