import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CalendarOff,
  CarFront,
  Clock3,
  FileCheck2,
} from 'lucide-react'
import { useWorkerAvailability } from '@/features/org-members/hooks/useWorkerAvailability'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { useWorkerProfileContext } from '../hooks/WorkerProfileContext'
import { useWorkerLeave, useWorkerVisits } from '../hooks/useWorkerProfile'
import { useWorkerCredentials } from '../hooks/useWorkerCredentials'
import {
  availabilitySummary,
  credentialLabels,
  credentialPriority,
  credentialStatus,
  dateLabel,
  hoursLabel,
  shiftDate,
  uniqueVisits,
  weekFrom,
  workerWeek,
} from '../lib/profile'
import { DOCUMENT_LABELS } from '../constants'
import { WorkerLoading, WorkerVisitRow } from './WorkerProfileUI'

export function WorkerOverview() {
  const { worker, today, now } = useWorkerProfileContext()
  const from = weekFrom(today),
    to = shiftDate(from, 6)
  const week = useWorkerVisits(worker.id, from, to),
    upcoming = useWorkerVisits(worker.id, today, shiftDate(today, 14))
  const credentials = useWorkerCredentials(worker.id),
    availability = useWorkerAvailability(worker.id)
  const year = Number(today.slice(0, 4)),
    leave = useWorkerLeave(worker.id, year),
    previousLeave = useWorkerLeave(worker.id, year - 1),
    nextLeave = useWorkerLeave(worker.id, year + 1)
  const [selected, setSelected] = useState<ShiftOccurrence | null>(null)
  const summary = workerWeek(week.data || [], from),
    cap = worker.max_hours_per_week
  const next = uniqueVisits(upcoming.data || [])
    .filter(
      (v) =>
        ['scheduled', 'in_progress'].includes(v.completion_status) &&
        v.end_time > now,
    )
    .slice(0, 2)
  const alerts = (credentials.data || [])
    .map((c) => ({ credential: c, status: credentialStatus(c, today) }))
    .filter((c) => ['expired', 'review', 'expiring'].includes(c.status))
    .sort((a, b) => credentialPriority[a.status] - credentialPriority[b.status])
  const first = alerts[0]
  const nextTimeOff = [
    ...(previousLeave.data || []),
    ...(leave.data || []),
    ...(nextLeave.data || []),
  ]
    .filter((r) => r.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  const leaveError = leave.isError || previousLeave.isError || nextLeave.isError
  return (
    <>
      <div className="wp-overview-grid">
        <section className="wp-week">
          <div className="wp-between">
            <h2>
              <span className="wp-highlight">This week</span>
            </h2>
            <span className="wp-label">
              {dateLabel(from, 'MMM d')}–{dateLabel(to, 'MMM d')}
            </span>
          </div>
          {week.isPending || week.isError ? (
            <WorkerLoading
              error={week.isError}
              retry={() => void week.refetch()}
            />
          ) : (
            <>
              <div className="wp-hours">
                <span>
                  {hoursLabel(summary.hours)}
                  <small>h</small>
                </span>
                <p className="wp-muted">
                  scheduled{' '}
                  {cap != null
                    ? `/ ${cap}h weekly limit`
                    : '· No weekly limit set'}
                </p>
              </div>
              {cap != null && cap > 0 && (
                <div
                  className={`wp-meter${summary.hours > cap ? ' wp-meter-over' : ''}`}
                  role="meter"
                  aria-label="Weekly scheduled hours"
                  aria-valuenow={summary.hours}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(cap, summary.hours)}
                  aria-valuetext={`${hoursLabel(summary.hours)} hours scheduled; ${cap} hour weekly limit`}
                >
                  <span
                    style={{
                      width: `${Math.min(100, (summary.hours / cap) * 100)}%`,
                    }}
                  />
                </div>
              )}
              <div className="wp-between wp-muted">
                <span>
                  {cap == null
                    ? "Cancelled and dropped shifts excluded"
                    : summary.hours > cap
                      ? `${hoursLabel(summary.hours - cap)}h over the weekly limit`
                      : `${hoursLabel(cap - summary.hours)}h below the weekly limit`}
                </span>
                <span>
                  {summary.count} {summary.count === 1 ? "shift" : "shifts"}
                </span>
              </div>
              <div className="wp-days" aria-label="Weekly scheduled hours">
                {summary.days.map((day) => (
                  <Link
                    key={day.date}
                    to="/dashboard/workers/$workerId/schedule"
                    params={{ workerId: worker.id }}
                    search={{ week: from, day: day.date }}
                    className={`wp-day${day.date === today ? ' wp-today' : ''}${!day.hours ? ' wp-day-off' : ''}`}
                    aria-label={`${dateLabel(day.date, 'EEEE, MMMM d')}, ${hoursLabel(day.hours)} hours`}
                  >
                    <span>{day.label}</span>
                    <span className="wp-day-number">
                      {dateLabel(day.date, 'd')}
                    </span>
                    <span className="wp-day-hours">
                      {day.hours ? `${hoursLabel(day.hours)}h` : '—'}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
          <div className="wp-next">
            <div className="wp-between">
              <span className="wp-label">Up next</span>
              <Link
                className="wp-link"
                to="/dashboard/workers/$workerId/schedule"
                params={{ workerId: worker.id }}
              >
                Full schedule <ArrowRight size={15} />
              </Link>
            </div>
            {upcoming.isPending || upcoming.isError ? (
              <WorkerLoading
                error={upcoming.isError}
                retry={() => void upcoming.refetch()}
              />
            ) : next.length ? (
              next.map((v) => (
                <WorkerVisitRow
                  key={`${v.shift_id}:${v.date}`}
                  visit={v}
                  today={today}
                  onSelect={() => setSelected(v)}
                />
              ))
            ) : (
              <p className="wp-empty">
                No upcoming shifts in the next 14 days.
                {worker.next_shift_at &&
                  worker.next_shift_at.slice(0, 10) > shiftDate(today, 14) && (
                    <>
                      {' '}
                      Next scheduled shift: {dateLabel(worker.next_shift_at)}.
                    </>
                  )}
              </p>
            )}
          </div>
        </section>
        <aside className="wp-stack">
          {credentials.isPending || credentials.isError ? (
            <WorkerLoading
              error={credentials.isError}
              retry={() => void credentials.refetch()}
            />
          ) : first ? (
            <section className="wp-attention">
              <p className="wp-label wp-row">
                <FileCheck2 size={17} />
                {credentialLabels[first.status]}
              </p>
              <h3>
                {DOCUMENT_LABELS[first.credential.document_type] ||
                  first.credential.document_type}
              </h3>
              <p className="wp-muted">
                {first.status === 'review'
                  ? 'An uploaded document is ready to verify.'
                  : `${first.status === 'expired' ? 'Expired' : 'Expires'} ${dateLabel(first.credential.expiry_date!)}`}
              </p>
              <Link
                className="wp-link"
                to="/dashboard/workers/$workerId/documents"
                params={{ workerId: worker.id }}
                search={{ document: first.credential.document_type }}
              >
                Review document <ArrowRight size={15} />
              </Link>
              {alerts.length > 1 && (
                <p className="wp-muted">
                  {alerts.length - 1} more{' '}
                  {alerts.length === 2 ? 'document needs' : 'documents need'}{' '}
                  attention
                </p>
              )}
            </section>
          ) : null}
          <section className="wp-essentials">
            <h3>Planning essentials</h3>
            <div className="wp-fact">
              <Clock3 size={17} />
              <div>
                {availability.isPending || availability.isError ? (
                  <WorkerLoading
                    error={availability.isError}
                    retry={() => void availability.refetch()}
                  />
                ) : (
                  <>
                    <strong>
                      {availabilitySummary(availability.data || [])}
                    </strong>
                    <p className="wp-muted">Recurring availability</p>
                  </>
                )}
              </div>
            </div>
            <div className="wp-fact">
              <CarFront size={17} />
              <div>
                <strong>
                  {worker.has_vehicle == null
                    ? 'Vehicle not recorded'
                    : worker.has_vehicle
                      ? 'Has a vehicle'
                      : 'No vehicle'}
                </strong>
                <p className="wp-muted">Recorded on profile</p>
              </div>
            </div>
            <div className="wp-fact">
              <CalendarOff size={17} />
              <div>
                {leave.isPending ||
                previousLeave.isPending ||
                nextLeave.isPending ||
                leaveError ? (
                  <WorkerLoading
                    error={leaveError}
                    retry={() => {
                      void leave.refetch()
                      void previousLeave.refetch()
                      void nextLeave.refetch()
                    }}
                  />
                ) : (
                  <>
                    <strong>
                      {nextTimeOff
                        ? `${dateLabel(nextTimeOff.start_date, 'MMM d')}–${dateLabel(nextTimeOff.end_date, 'MMM d')}`
                        : 'No upcoming leave recorded'}
                    </strong>
                    {nextTimeOff && (
                      <Link
                        className="wp-link"
                        to="/dashboard/workers/$workerId/attendance"
                        params={{ workerId: worker.id }}
                        search={{ section: 'leave' }}
                      >
                        Recorded leave
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
            <Link
              className="wp-link"
              to="/dashboard/workers/$workerId/schedule"
              params={{ workerId: worker.id }}
            >
              View availability <ArrowRight size={15} />
            </Link>
          </section>
        </aside>
      </div>
      <section className="wp-clients">
        <div className="wp-between">
          <h3>Clients in {worker.first_name}’s week</h3>
          <Link
            className="wp-link"
            to="/dashboard/workers/$workerId/assignments"
            params={{ workerId: worker.id }}
          >
            Manage assignments <ArrowRight size={15} />
          </Link>
        </div>
        {week.isPending || week.isError ? (
          <WorkerLoading
            error={week.isError}
            retry={() => void week.refetch()}
          />
        ) : summary.clients.length ? (
          summary.clients.map((client) => (
            <div className="wp-client-row" key={client.id}>
              <div className="wp-mini-avatar" aria-hidden="true">
                {client.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div>
                <Link
                  to="/dashboard/clients/$clientId"
                  params={{ clientId: client.id }}
                >
                  {client.name}
                </Link>
                <p className="wp-muted">
                  {[...client.days].join(', ')} · Scheduled care
                </p>
              </div>
              <div className="wp-client-hours">
                {hoursLabel(client.hours)}h<small>this week</small>
              </div>
            </div>
          ))
        ) : (
          <p className="wp-empty">No shifts scheduled this week.</p>
        )}
      </section>
      {selected && (
        <ShiftDetailDrawer shift={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
