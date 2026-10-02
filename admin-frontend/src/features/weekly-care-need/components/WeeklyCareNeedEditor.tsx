import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2, ArrowRight, ShieldCheck, Check } from 'lucide-react'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import { useClient } from '@/features/clients/hooks/useClients'
import { useClientAuthorizations } from '@/features/authorizations/hooks/useAuthorizations'
import { usePlacements } from '@/features/placements/hooks/usePlacements'
import { PostPlacementDrawer } from '@/features/placements/components/PostPlacementDrawer'
import { PlacementCoverage } from '@/features/placements/components/PlacementCoverage'
import {
  WEEKDAYS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
} from '@/features/authorizations/constants'
import type { WeekDay, ServiceType } from '@/features/authorizations/api'
import { fmtHours } from '@/features/authorizations/utils'
import {
  ClientBadge,
  ClientDialog,
  ClientEmpty,
  ClientLoading,
} from '@/features/clients/components/ClientWorkspaceUI'
import {
  authorizationForDate,
  careState,
  fundingRows,
  weeklyHours,
  validateSlots,
  errorMessage,
} from '@/features/clients/lib/care'
import {
  useCareNeedVersions,
  useSaveWeeklyCareNeed,
} from '../hooks/useWeeklyCareNeed'
import type { CareSlotInput, WeeklyCareNeed } from '../api'

type Group = {
  key: string
  days: WeekDay[]
  start_time: string
  end_time: string
  service_type: ServiceType
}
function groupsFor(need?: WeeklyCareNeed): Group[] {
  const groups: Group[] = []
  for (const slot of need?.care_slots || []) {
    const group = groups.find(
      (g) =>
        g.start_time === slot.start_time.slice(0, 5) &&
        g.end_time === slot.end_time.slice(0, 5) &&
        g.service_type === slot.service_type,
    )
    if (group) group.days.push(slot.day_of_week)
    else
      groups.push({
        key: crypto.randomUUID(),
        days: [slot.day_of_week],
        start_time: slot.start_time.slice(0, 5),
        end_time: slot.end_time.slice(0, 5),
        service_type: slot.service_type,
      })
  }
  return groups
}
export function WeeklyCareNeedEditor({
  clientId,
  enforceCompliance = true,
  attentionNeedId,
}: {
  clientId: string
  enforceCompliance?: boolean
  attentionNeedId?: string
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const needs = useCareNeedVersions(clientId)
  const authorizations = useClientAuthorizations(clientId)
  const placements = usePlacements()
  const client = useClient(clientId)
  const save = useSaveWeeklyCareNeed(clientId)
  const [selectedId, setSelectedId] = useState(attentionNeedId || '')
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(today)
  const [groups, setGroups] = useState<Group[]>([])
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  const [review, setReview] = useState<string | null>(null)
  useUnsavedChanges(editing && !save.isPending)
  const latest = needs.data?.[0]
  const selected = needs.data?.find((n) => n.id === selectedId) || latest
  const placement = placements.data?.find(
    (p) => p.weekly_care_need_id === selected?.id,
  )
  const slots: CareSlotInput[] = editing
    ? groups.flatMap((g) =>
        g.days.map((day) => ({
          day_of_week: day,
          start_time: g.start_time,
          end_time: g.end_time,
          service_type: g.service_type,
        })),
      )
    : selected?.care_slots || []
  const checkDate = editing
    ? date
    : selected?.scheduled_from || selected?.effective_from || today
  const auth = authorizationForDate(authorizations.data || [], checkDate)
  const funding = fundingRows(auth, slots)
  const invalid =
    validateSlots(slots) ||
    (editing && groups.some((g) => !g.days.length)
      ? 'Select at least one day for each care slot group.'
      : '')
  const over =
    enforceCompliance && (!auth || funding.some((row) => row.remaining < -1e-9))
  const status = selected
    ? careState(selected, today, !!placement, selected.id === latest?.id)
    : ''
  function createRevision() {
    setGroups(groupsFor(selected))
    setDate(
      selected?.effective_from && selected.effective_from > today
        ? selected.effective_from
        : today,
    )
    setError('')
    setEditing(true)
  }
  function update(key: string, patch: Partial<Group>) {
    setGroups((prev) =>
      prev.map((g) => (g.key === key ? { ...g, ...patch } : g)),
    )
    setError('')
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
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
            </div>
            <div className="cw-panel-body">
              {groups.map((group, index) => (
                <fieldset key={group.key} className="cw-editor-group">
                  <legend className="cw-label px-2">
                    Care slot {index + 1}
                  </legend>
                  <div className="cw-slot-inputs">
                    <label className="cw-field">
                      Service
                      <select
                        className="cw-input"
                        value={group.service_type}
                        onChange={(e) =>
                          update(group.key, {
                            service_type: e.target.value as ServiceType,
                          })
                        }
                      >
                        {SERVICE_TYPES.map((s) => (
                          <option key={s} value={s}>
                            {SERVICE_TYPE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="cw-field">
                      Start time
                      <input
                        className="cw-input"
                        type="time"
                        value={group.start_time}
                        onChange={(e) =>
                          update(group.key, { start_time: e.target.value })
                        }
                      />
                    </label>
                    <label className="cw-field">
                      End time
                      <input
                        className="cw-input"
                        type="time"
                        value={group.end_time}
                        onChange={(e) =>
                          update(group.key, { end_time: e.target.value })
                        }
                      />
                    </label>
                    <button
                      className="cw-icon"
                      aria-label={`Remove care slot ${index + 1}`}
                      onClick={() =>
                        setGroups((prev) =>
                          prev.filter((g) => g.key !== group.key),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="cw-day-picker">
                    {WEEKDAYS.map((day) => (
                      <label key={day.key}>
                        <span>
                          <input
                            type="checkbox"
                            checked={group.days.includes(day.key)}
                            onChange={(e) =>
                              update(group.key, {
                                days: e.target.checked
                                  ? [...group.days, day.key]
                                  : group.days.filter((d) => d !== day.key),
                              })
                            }
                          />
                          {day.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <div className="cw-between">
                <button
                  className="cw-btn"
                  onClick={() =>
                    setGroups((prev) => [
                      ...prev,
                      {
                        key: crypto.randomUUID(),
                        days: [],
                        start_time: '09:00',
                        end_time: '11:00',
                        service_type: 'personal_care',
                      },
                    ])
                  }
                >
                  <Plus size={15} /> Add care slot
                </button>
                <span className="text-sm">
                  {fmtHours(weeklyHours(slots))}h / week · {slots.length} care
                  slots
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
                              <span>
                                {SERVICE_TYPE_LABELS[slot.service_type]}
                              </span>
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
            Choose a start date, days, services and times.
          </ClientEmpty>
        )}
        {(selected || editing) && enforceCompliance && (
          <div className="cw-funding-strip">
            <ShieldCheck size={17} />
            <span>Funding · 2-week need / limit</span>
            {authorizations.isPending ? (
              'Checking…'
            ) : authorizations.isError ? (
              <span role="alert">
                Funding check unavailable.{' '}
                <button
                  className="cw-link"
                  onClick={() => void authorizations.refetch()}
                >
                  Retry
                </button>
              </span>
            ) : !auth ? (
              <span className="text-orange">
                No authorization for {checkDate}
              </span>
            ) : (
              funding
                .filter((row) => row.needed > 0)
                .map((row) => (
                  <span
                    key={row.service}
                    className={`cw-row ${row.remaining < 0 ? 'text-orange' : ''}`}
                  >
                    {SERVICE_TYPE_LABELS[row.service]}{' '}
                    <strong className="font-mono text-xs">
                      {fmtHours(row.needed)} / {fmtHours(row.limit)}h
                    </strong>
                    {row.remaining >= 0 && <Check size={14} />}
                  </span>
                ))
            )}
            <Link
              className="cw-link ml-auto"
              to="/dashboard/clients/$clientId/funding"
              params={{ clientId }}
            >
              Funding <ArrowRight size={15} />
            </Link>
          </div>
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
              disabled={
                save.isPending ||
                over ||
                (enforceCompliance &&
                  (authorizations.isPending || authorizations.isError))
              }
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
                  <button
                    className="cw-btn cw-btn-primary"
                    onClick={() => setReview(placement.id)}
                  >
                    Review coverage <ArrowRight size={15} />
                  </button>
                  {selected.id === latest?.id &&
                    placement.status === 'closed' &&
                    !selected.ends_on && (
                      <button
                        className="cw-btn"
                        onClick={() => setPosting(true)}
                      >
                        Reopen placement
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
                    <ArrowRight size={15} /> Post as open placement
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
      {review && (
        <ClientDialog
          title="Review coverage"
          wide
          onClose={() => setReview(null)}
        >
          <PlacementCoverage placementId={review} embedded />
        </ClientDialog>
      )}
    </div>
  )
}
