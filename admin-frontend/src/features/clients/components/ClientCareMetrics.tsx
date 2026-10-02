import { useState } from 'react'
import { addDays, addWeeks, format, parseISO, startOfWeek } from 'date-fns'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  List,
  FileText,
} from 'lucide-react'
import { Avatar, ShiftStatusBadge } from '@/shared/components/ui'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { useCalendarShifts } from '@/features/shifts/hooks/useShifts'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { fmtHours } from '@/features/authorizations/utils'
import { useClientNotes } from '../hooks/useClients'
import { countsAsCare, serviceName, visitHours, visitKey } from '../lib/care'
import {
  ClientEmpty,
  ClientLoading,
  ClientPanel,
  ClientBadge,
} from './ClientWorkspaceUI'
import { ClientVisitDialog } from './ClientVisitDialog'

export function ClientCareMetrics({ clientId }: { clientId: string }) {
  const [offset, setOffset] = useState(0)
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState<ShiftOccurrence | null>(null)
  const start = addWeeks(
    startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON }),
    offset,
  )
  const from = format(start, 'yyyy-MM-dd'),
    to = format(addDays(start, 6), 'yyyy-MM-dd')
  const visits = useCalendarShifts(from, to, undefined, clientId)
  const notes = useClientNotes(clientId, from, to)
  const all = [...(visits.data || [])].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  )
  const scheduled = (v: ShiftOccurrence) =>
    ['scheduled', 'in_progress'].includes(v.completion_status)
  const visible = all.filter(
    (v) =>
      filter === 'all' ||
      (filter === 'scheduled'
        ? scheduled(v)
        : v.completion_status === 'completed'),
  )
  const recorded = new Set(
    (notes.data || [])
      .filter((n) => n.entries.some((e) => e.content.trim()))
      .map((n) => `${n.shift_id}:${n.occurrence_date}`),
  )
  const completed = visible.filter((v) => v.completion_status === 'completed')
  const missing = completed.filter((v) => !recorded.has(visitKey(v))).length
  const sum = (rows: ShiftOccurrence[]) =>
    fmtHours(rows.filter(countsAsCare).reduce((n, v) => n + visitHours(v), 0))
  return (
    <div>
      <div className="cw-toolbar">
        <div className="cw-segments">
          {[
            ['all', 'All visits', all.length],
            ['scheduled', 'Scheduled', all.filter(scheduled).length],
            [
              'completed',
              'Completed',
              all.filter((v) => v.completion_status === 'completed').length,
            ],
          ].map(([value, label, count]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(String(value))}
            >
              {label}
              <span className="cw-count">{count}</span>
            </button>
          ))}
        </div>
        <div className="cw-visit-controls">
          <div className="cw-period" role="group" aria-label="Visit week">
            <button
              className="cw-icon"
              aria-label="Previous week"
              onClick={() => setOffset((v) => v - 1)}
            >
              <ArrowLeft size={15} />
            </button>
            <span>
              {format(start, 'MMM d')} –{' '}
              {format(addDays(start, 6), 'MMM d, yyyy')}
            </span>
            <button
              className="cw-icon"
              aria-label="Next week"
              onClick={() => setOffset((v) => v + 1)}
            >
              <ArrowRight size={15} />
            </button>
            <button className="cw-btn" onClick={() => setOffset(0)}>
              This week
            </button>
          </div>
          <div className="cw-view">
            {[
              ['list', 'List'],
              ['week', 'Week'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`cw-btn ${view === value ? 'cw-btn-primary' : ''}`}
                aria-pressed={view === value}
                onClick={() => setView(value)}
              >
                {value === 'list' ? (
                  <List size={14} />
                ) : (
                  <CalendarDays size={14} />
                )}{' '}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {visits.isPending || visits.isError ? (
        <ClientLoading
          error={visits.isError}
          retry={() => void visits.refetch()}
        />
      ) : view === 'list' ? (
        <div className="cw-table-scroll">
          <table className="cw-table">
            <thead>
              <tr>
                {[
                  'Date & time',
                  'Service',
                  'Worker',
                  'Duration',
                  'Status',
                  'Notes',
                  '',
                ].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((v) => (
                <tr key={visitKey(v)}>
                  <td>
                    <button className="cw-link" onClick={() => setSelected(v)}>
                      {format(parseISO(v.date), 'MMM d')}
                    </button>
                    <small className="font-mono">
                      {format(parseISO(v.start_time), 'HH:mm')}–
                      {format(parseISO(v.end_time), 'HH:mm')}
                    </small>
                  </td>
                  <td>{serviceName(v.service_type)}</td>
                  <td>
                    <div className="cw-person">
                      <Avatar
                        initials={`${v.worker.first_name[0]}${v.worker.last_name[0]}`}
                        color="c4"
                        size="sm"
                      />
                      {v.worker.first_name} {v.worker.last_name}
                    </div>
                  </td>
                  <td>{fmtHours(visitHours(v))}h</td>
                  <td>
                    <ShiftStatusBadge status={v.completion_status} />
                  </td>
                  <td>
                    {notes.isPending ? (
                      '…'
                    ) : notes.isError ? (
                      <span className="cw-muted">Unavailable</span>
                    ) : recorded.has(visitKey(v)) ? (
                      <button
                        className="cw-link text-emerald-800"
                        onClick={() => setSelected(v)}
                      >
                        <FileText size={15} />
                        Recorded
                      </button>
                    ) : v.completion_status === 'completed' ? (
                      <ClientBadge tone="yellow">Missing</ClientBadge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <button
                      className="cw-icon"
                      aria-label={`Open visit on ${v.date} at ${format(parseISO(v.start_time), 'HH:mm')}`}
                      onClick={() => setSelected(v)}
                    >
                      <ArrowRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={7}>
                    <ClientEmpty title="No visits in this view">
                      Choose another week or schedule a visit.
                    </ClientEmpty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cw-week-scroll">
          <div className="cw-week">
            {Array.from({ length: 7 }, (_, i) => {
              const date = addDays(start, i),
                iso = format(date, 'yyyy-MM-dd')
              return (
                <div className="cw-day" key={iso}>
                  <p className="cw-label">{format(date, 'EEE')}</p>
                  <h3 className="mt-2">{format(date, 'd')}</h3>
                  {visible
                    .filter((v) => v.date === iso)
                    .map((v) => (
                      <button
                        key={visitKey(v)}
                        className="cw-slot"
                        onClick={() => setSelected(v)}
                      >
                        <strong>
                          {format(parseISO(v.start_time), 'HH:mm')}–
                          {format(parseISO(v.end_time), 'HH:mm')}
                        </strong>
                        <span>{serviceName(v.service_type)}</span>
                        <small>
                          {v.worker.first_name} {v.worker.last_name}
                        </small>
                        <span>
                          <ShiftStatusBadge status={v.completion_status} />
                        </span>
                      </button>
                    ))}
                  {!visible.some((v) => v.date === iso) && (
                    <p className="cw-muted mt-4">No visits</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {!visits.isPending && !visits.isError && (
        <div className="cw-summary">
          <span>
            {visible.length} visits{' '}
            <span className="cw-muted">· {sum(visible)}h total care</span>
          </span>
          <div className="cw-row cw-muted">
            {filter === 'all' && completed.length > 0 && (
              <span>Completed {sum(completed)}h</span>
            )}
            {completed.length > 0 && notes.isSuccess && (
              <span>
                Notes {completed.length - missing} recorded
                {missing > 0 && (
                  <span className="text-orange"> · {missing} missing</span>
                )}
              </span>
            )}
            {notes.isError && (
              <button className="cw-link" onClick={() => void notes.refetch()}>
                Retry notes
              </button>
            )}
          </div>
        </div>
      )}
      {!visits.isPending && !visits.isError && (
        <ClientPanel
          title="Care by service"
          action={<span className="cw-label">Selected week</span>}
        >
          <div className="overflow-x-auto">
            <table className="cw-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Scheduled</th>
                  <th>Completed</th>
                  <th>Visits</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...new Set(
                    all.filter(countsAsCare).map((v) => v.service_type),
                  ),
                ].map((service) => {
                  const rows = all.filter(
                    (v) => v.service_type === service && countsAsCare(v),
                  )
                  return (
                    <tr key={service || 'none'}>
                      <td>{serviceName(service)}</td>
                      <td>{sum(rows)}h</td>
                      <td>
                        {sum(
                          rows.filter(
                            (v) => v.completion_status === 'completed',
                          ),
                        )}
                        h
                      </td>
                      <td>{rows.length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ClientPanel>
      )}
      {selected && (
        <ClientVisitDialog visit={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
