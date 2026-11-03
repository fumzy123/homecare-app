import { useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useWorkerAvailability } from '@/features/org-members/hooks/useWorkerAvailability'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { useWorkerProfileContext } from '../hooks/WorkerProfileContext'
import { useWorkerVisits } from '../hooks/useWorkerProfile'
import {
  dateLabel,
  hoursLabel,
  shiftDate,
  timeLabel,
  weekFrom,
  workerWeek,
  WORKER_DAYS,
} from '../lib/profile'
import { WorkerLoading, WorkerPanel, WorkerVisitRow } from './WorkerProfileUI'
import { WorkerAvailabilityDialog } from './WorkerAvailabilityDialog'

export function WorkerSchedule({ week, day }: { week?: string; day?: string }) {
  const { worker, today } = useWorkerProfileContext(),
    navigate = useNavigate()
  const from = weekFrom(week || today),
    to = shiftDate(from, 6)
  const query = useWorkerVisits(worker.id, from, to),
    availability = useWorkerAvailability(worker.id)
  const [editing, setEditing] = useState(false),
    [selected, setSelected] = useState<ShiftOccurrence | null>(null)
  const summary = workerWeek(query.data || [], from)
  const displayed =
    day && day >= from && day <= to
      ? summary.days.filter((d) => d.date === day)
      : summary.days
  const go = (date: string) =>
    void navigate({
      to: '/dashboard/workers/$workerId/schedule',
      params: { workerId: worker.id },
      search: { week: date },
    })
  return (
    <>
      <div className="wp-section-heading wp-between">
        <div>
          <h2>A clear view of the week.</h2>
          <p className="wp-muted">
            {dateLabel(from)}–{dateLabel(to)}
          </p>
        </div>
        <button
          className="wp-btn"
          disabled={!availability.isSuccess || availability.isError}
          onClick={() => setEditing(true)}
        >
          Edit availability <Pencil size={14} />
        </button>
      </div>
      <div className="wp-week-nav">
        <button
          className="wp-icon"
          aria-label="Previous week"
          onClick={() => go(shiftDate(from, -7))}
        >
          <ChevronLeft size={17} />
        </button>
        <button className="wp-btn" onClick={() => go(weekFrom(today))}>
          This week
        </button>
        <button
          className="wp-icon"
          aria-label="Next week"
          onClick={() => go(shiftDate(from, 7))}
        >
          <ChevronRight size={17} />
        </button>
        {day && (
          <button className="wp-link" onClick={() => go(from)}>
            Show full week
          </button>
        )}
      </div>
      <div className="wp-schedule-grid">
        <WorkerPanel
          title="Scheduled visits"
          action={
            !query.isPending &&
            !query.isError && (
              <span className="wp-muted">
                {summary.count} visits · {hoursLabel(summary.hours)}h
              </span>
            )
          }
        >
          {query.isPending || query.isError ? (
            <WorkerLoading
              error={query.isError}
              retry={() => void query.refetch()}
            />
          ) : (
            displayed.map((d) => (
              <section className="wp-schedule-day" key={d.date}>
                <div className="wp-between">
                  <h4>
                    {dateLabel(d.date, 'EEEE, MMM d')}
                    {d.date === today && ' · Today'}
                  </h4>
                  <span className="wp-muted">{hoursLabel(d.hours)}h</span>
                </div>
                {d.visits.length ? (
                  d.visits.map((v) => (
                    <WorkerVisitRow
                      key={`${v.shift_id}:${v.date}`}
                      visit={v}
                      onSelect={() => setSelected(v)}
                      showStatus
                    />
                  ))
                ) : (
                  <p className="wp-muted wp-gap">No visits scheduled</p>
                )}
              </section>
            ))
          )}
        </WorkerPanel>
        <section>
          <h3>Recurring availability</h3>
          <p className="wp-muted wp-gap">
            Recorded available times, before scheduled visits.
          </p>
          {availability.isPending || availability.isError ? (
            <WorkerLoading
              error={availability.isError}
              retry={() => void availability.refetch()}
            />
          ) : (
            WORKER_DAYS.map((d) => (
              <div className="wp-availability-row" key={d.key}>
                <span>{d.label}</span>
                <span className="wp-muted">
                  {availability.data
                    .filter((e) => e.day_of_week === d.key)
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map(
                      (e) =>
                        `${timeLabel(e.start_time)}–${timeLabel(e.end_time)}`,
                    )
                    .join(', ') || 'Not recorded'}
                </span>
              </div>
            ))
          )}
          <div className="wp-notice">
            <strong>
              {worker.max_hours_per_week == null
                ? 'No weekly limit set'
                : `Weekly limit · ${worker.max_hours_per_week}h`}
            </strong>
            <p className="wp-gap">
              Review existing visits and recorded leave when arranging care.
            </p>
            <Link
              className="wp-link wp-gap"
              to="/dashboard/workers/$workerId/attendance"
              params={{ workerId: worker.id }}
              search={{ section: 'leave' }}
            >
              View leave
            </Link>
          </div>
        </section>
      </div>
      {editing && availability.data && (
        <WorkerAvailabilityDialog
          workerId={worker.id}
          entries={availability.data}
          onClose={() => setEditing(false)}
        />
      )}
      {selected && (
        <ShiftDetailDrawer shift={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
