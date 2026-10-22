import { useState } from 'react'
import { useAgencyDate } from '@/features/placements/hooks/useAgencyDate'
import { format, parseISO } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { Plus, ArrowRight } from 'lucide-react'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import { useClient } from '@/features/clients/hooks/useClients'
import { usePlacements } from '@/features/placements/hooks/usePlacements'
import { PostPlacementDrawer } from '@/features/placements/components/PostPlacementDrawer'
import { WEEKDAYS } from '@/features/weekly-care-need/constants'
import { fmtHours } from '@/features/weekly-care-need/utils'
import {
  ClientBadge,
  ClientEmpty,
  ClientLoading,
} from '@/features/clients/components/ClientWorkspaceUI'
import {
  careState,
  weeklyHours,
  validateSlots,
  errorMessage,
} from '@/features/clients/lib/care'
import {
  useCareNeedVersions,
  useSaveWeeklyCareNeed,
} from '../hooks/useWeeklyCareNeed'
import type { CareSlotInput } from '../api'
import { WeeklyCareBoard, type DraftCareSlot } from './WeeklyCareBoard'

export function WeeklyCareNeedEditor({
  clientId,
  attentionNeedId,
}: {
  clientId: string
  attentionNeedId?: string
}) {
  const today = useAgencyDate()
  const needs = useCareNeedVersions(clientId)
  const placements = usePlacements()
  const client = useClient(clientId)
  const save = useSaveWeeklyCareNeed(clientId)
  const [selectedId, setSelectedId] = useState(attentionNeedId || '')
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(today)
  const [draftSlots, setDraftSlots] = useState<DraftCareSlot[]>([])
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  useUnsavedChanges(editing && !save.isPending)
  const latest = needs.data?.[0]
  const selected = needs.data?.find((n) => n.id === selectedId) || latest
  const placement = placements.data?.find(
    (p) => p.weekly_care_need_id === selected?.id,
  )
  const slots: CareSlotInput[] = editing
    ? draftSlots.map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time }))
    : selected?.care_slots || []
  const checkDate = editing
    ? date
    : selected?.scheduled_from || selected?.effective_from || today
  const invalid = validateSlots(slots)
  const status = selected
    ? careState(selected, today, !!placement, selected.id === latest?.id)
    : ''
  function createRevision() {
    setDraftSlots((selected?.care_slots || []).map(slot => ({
      key: slot.id,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time.slice(0, 5),
      end_time: slot.end_time.slice(0, 5),
    })))
    setDate(
      selected?.effective_from && selected.effective_from > today
        ? selected.effective_from
        : today,
    )
    setError('')
    setEditing(true)
  }
  function updateSlots(next: DraftCareSlot[]) {
    const problem = next.length ? validateSlots(next) : ''
    if (problem) return problem
    setDraftSlots(next)
    setError('')
    return ''
  }
  async function submit() {
    if (invalid || !date || date < today) {
      setError(invalid || 'Choose a start date today or later.')
      return
    }
    setError('')
    try {
      const result = await save.mutateAsync({
        effective_from: date,
        care_slots: slots,
      })
      setSelectedId(result.id)
      setEditing(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  if (needs.isPending || needs.isError)
    return (
      <ClientLoading error={needs.isError} retry={() => void needs.refetch()} />
    )
  return (
    <div>
      <header className="mb-7">
        <p className="cw-label mb-2">Recurring care</p>
        <h2>Weekly care need</h2>
      </header>
      {attentionNeedId &&
        !needs.data?.some((n) => n.id === attentionNeedId) && (
          <p role="status" className="cw-error mb-4">
            The requested care revision is no longer available. Showing the
            latest record.
          </p>
        )}
      <section className="cw-panel" aria-label="Weekly care need workspace">
        <header className="cw-panel-heading">
          <div className="cw-row">
            <h3>
              {editing
                ? 'New revision'
                : selected
                  ? `Revision ${selected.version}`
                  : 'Weekly care need'}
            </h3>
            {!editing && selected && (
              <ClientBadge
                tone={
                  status === 'Current'
                    ? 'mint'
                    : status.startsWith('Saved') || status.startsWith('Posted')
                      ? 'yellow'
                      : ''
                }
              >
                {status}
              </ClientBadge>
            )}
          </div>
          {!editing && (
            <button className="cw-btn" onClick={createRevision}>
              <Plus size={15} />
              {selected ? 'Create new revision' : 'Create weekly care need'}
            </button>
          )}
        </header>
        {editing ? (
          <>
            <div className="cw-panel-body border-b border-line-soft">
              <label className="cw-field max-w-xs">
                Revision starts
                <input
                  className="cw-input"
                  type="date"
                  min={today}
                  value={date}
                  disabled={save.isPending}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
                <span className="cw-muted">Choose today or a future date. Existing visits change only after you approve the new coverage.</span>
              </label>
            </div>
            <div className="cw-panel-body">
              <WeeklyCareBoard slots={draftSlots} onChange={updateSlots} disabled={save.isPending} />
              <div className="cw-between mt-5">
                <p className="cw-muted">Save this revision, then review coverage to schedule visits.</p>
                <span className="text-sm" aria-live="polite">
                  {fmtHours(weeklyHours(slots))}h / week · {slots.length} care slots
                </span>
              </div>
            </div>
          </>
        ) : selected ? (
          <>
            <dl className="cw-facts cw-panel-body">
              <div>
                <dt className="cw-label">
                  {selected.scheduled_from
                    ? 'Scheduled from'
                    : 'Proposed start'}
                </dt>
                <dd>{format(parseISO(checkDate), 'MMM d, yyyy')}</dd>
              </div>
              <div>
                <dt className="cw-label">Weekly care need</dt>
                <dd>
                  {fmtHours(weeklyHours(slots))} hours ·{' '}
                  <span className="cw-muted">{slots.length} care slots</span>
                </dd>
              </div>
              <div>
                <dt className="cw-label">Scheduling</dt>
                <dd>
                  {selected.ends_on && selected.ends_on < today
                    ? `Ended ${format(parseISO(selected.ends_on), 'MMM d')}`
                    : selected.scheduled_from
                      ? 'Coverage approved'
                      : 'Not scheduled'}
                </dd>
              </div>
            </dl>
            <div className="cw-panel-body pt-0">
              <div className="cw-week-scroll">
                <div className="cw-week">
                  {WEEKDAYS.map((day) => (
                    <div className="cw-day" key={day.key}>
                      <p className="cw-label">{day.label}</p>
                      {selected.care_slots
                        .filter((s) => s.day_of_week === day.key)
                        .map((slot) => {
                          const assigned = placement?.care_slots.find(
                            (s) => s.id === slot.id,
                          )
                          return (
                            <div
                              key={slot.id}
                              className={`cw-slot ${assigned?.worker_id ? '' : 'cw-slot-open'}`}
                            >
                              <strong>
                                {slot.start_time.slice(0, 5)}–
                                {slot.end_time.slice(0, 5)}
                              </strong>

                              <small>
                                {assigned?.worker_name ||
                                  (selected.imported
                                    ? 'Imported care slot'
                                    : status === 'Ended'
                                      ? 'Past care slot'
                                      : 'Open care slot')}
                              </small>
                              <small>{fmtHours(weeklyHours([slot]))}h</small>
                            </div>
                          )
                        })}
                      {!slots.some((s) => s.day_of_week === day.key) && (
                        <p className="cw-muted mt-5">No care slots</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <ClientEmpty title="Start with the care they need">
            Choose a start date, days and times.
          </ClientEmpty>
        )}
        {error && (
          <p role="alert" className="cw-error m-5">
            {error}
          </p>
        )}
        {editing ? (
          <footer className="cw-workbench-footer">
            <button
              className="cw-btn"
              disabled={save.isPending}
              onClick={() => {
                setEditing(false)
                setError('')
              }}
            >
              Cancel
            </button>
            <button
              className="cw-btn cw-btn-primary"
              disabled={save.isPending}
              onClick={() => void submit()}
            >
              {save.isPending ? 'Saving…' : 'Save revision'}
            </button>
          </footer>
        ) : (
          selected && (
            <footer className="cw-workbench-footer">
              {placements.isError ? (
                <p role="alert" className="cw-muted">
                  Coverage unavailable.{' '}
                  <button
                    className="cw-link"
                    onClick={() => void placements.refetch()}
                  >
                    Retry
                  </button>
                </p>
              ) : placement ? (
                <>
                  <Link className="cw-btn cw-btn-primary" to="/dashboard/placements/$placementId" params={{ placementId: placement.id }}>
                    View posted care request <ArrowRight size={15} />
                  </Link>
                  {selected.id === latest?.id &&
                    placement.status === 'closed' &&
                    !selected.ends_on && (
                      <button
                        className="cw-btn"
                        onClick={() => setPosting(true)}
                      >
                        Reopen care request
                      </button>
                    )}
                </>
              ) : (
                selected.id === latest?.id &&
                !selected.imported &&
                !selected.ends_on && (
                  <button
                    className="cw-btn cw-btn-primary"
                    disabled={placements.isPending}
                    onClick={() => setPosting(true)}
                  >
                    <ArrowRight size={15} /> Post care request
                  </button>
                )
              )}
            </footer>
          )
        )}
      </section>
      <section className="cw-history">
        <div className="cw-between mb-5">
          <h3>Weekly care need history</h3>
          <span className="cw-muted">{needs.data?.length || 0} revisions</span>
        </div>
        {needs.data?.length ? (
          <div className="cw-table-scroll">
            <table className="cw-table">
              <thead>
                <tr>
                  {['Revision', 'Starts', 'Weekly care', 'Status', ''].map(
                    (h, i) => (
                      <th key={i}>{h}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {needs.data.map((need) => (
                  <tr key={need.id}>
                    <td>
                      Revision {need.version}
                      <small>
                        Saved {format(parseISO(need.created_at), 'MMM d, yyyy')}
                      </small>
                    </td>
                    <td>
                      {format(
                        parseISO(need.scheduled_from || need.effective_from),
                        'MMM d, yyyy',
                      )}
                      {need.ends_on && (
                        <small>
                          Ends {format(parseISO(need.ends_on), 'MMM d, yyyy')}
                        </small>
                      )}
                    </td>
                    <td>
                      {fmtHours(weeklyHours(need.care_slots))}h ·{' '}
                      {need.care_slots.length} slots
                    </td>
                    <td>
                      <ClientBadge>
                        {careState(
                          need,
                          today,
                          placements.data?.some(
                            (p) => p.weekly_care_need_id === need.id,
                          ),
                          need.id === latest?.id,
                        )}
                      </ClientBadge>
                    </td>
                    <td>
                      <button
                        className="cw-link"
                        aria-label={`View revision ${need.version}`}
                        disabled={editing}
                        onClick={() => {
                          setSelectedId(need.id)
                          document
                            .querySelector(
                              '[aria-label="Weekly care need workspace"]',
                            )
                            ?.scrollIntoView({
                              block: 'start',
                              behavior: 'smooth',
                            })
                        }}
                      >
                        View <ArrowRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="cw-muted">Saved revisions will appear here.</p>
        )}
      </section>
      {posting && client.data && (
        <PostPlacementDrawer
          clients={[client.data]}
          preselectedClientId={clientId}
          weeklyCareNeedId={selected?.id}
          onClose={() => setPosting(false)}
        />
      )}
    </div>
  )
}
