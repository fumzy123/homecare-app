import { AttendanceSummary } from './AttendanceSummary'
import { useConfirmation } from '@/shared/components/confirmation'
import { formatDateRange, MAX_INPUT_MONTH } from '@/shared/lib/date'
import { useState } from 'react'
import { format, endOfMonth, parseISO } from 'date-fns'
import { Plus } from 'lucide-react'
import { countDays, LEAVE_TYPE_LABELS } from '@/features/leave/api'
import { errorMessage } from '@/features/clients/lib/care'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { useWorkerProfileContext } from '../hooks/WorkerProfileContext'
import {
  useWorkerLeave,
  useWorkerLeaveMutations,
  useWorkerVisits,
} from '../hooks/useWorkerProfile'
import { attendanceStats, attendanceVisits, dateLabel } from '../lib/profile'
import { WorkerLoading, WorkerPanel } from './WorkerProfileUI'
import { RecordLeaveModal } from './RecordLeaveModal'
import { WorkerAttendanceReport } from './WorkerAttendanceReport'

export function WorkerAttendance({ section }: { section?: string }) {
  const confirm = useConfirmation()
  const { worker, today } = useWorkerProfileContext()
  const [month, setMonth] = useState(today.slice(0, 7)),
    [year, setYear] = useState(Number(today.slice(0, 4)))
  const [period, setPeriod] = useState<'month' | 'year'>('month')
  const [recording, setRecording] = useState(false),
    [selected, setSelected] = useState<ShiftOccurrence | null>(null)
  const from = period === 'year' ? `${month.slice(0, 4)}-01-01` : `${month}-01`
  const to =
    period === 'year'
      ? `${month.slice(0, 4)}-12-31`
      : format(endOfMonth(parseISO(from)), 'yyyy-MM-dd')
  const visits = useWorkerVisits(worker.id, from, to)
  const leave = useWorkerLeave(worker.id, year),
    mutations = useWorkerLeaveMutations(worker.id)
  const periodVisits = attendanceVisits(visits.data || [], from, to)
  const stats = attendanceStats(periodVisits)
  const outcomes = periodVisits
    .filter((v) =>
      ['completed', 'no_show', 'dropped', 'cancelled'].includes(
        v.completion_status,
      ),
    )
    .reverse()
  const statusLabels: Record<string, string> = {
    completed: 'Completed',
    no_show: 'Missed',
    dropped: 'Dropped',
    cancelled: 'Cancelled',
  }
  const leavePanel = (
    <WorkerPanel
      title="Leave records"
      action={
        <div className="wp-leave-toolbar">
          <label className="wp-leave-year">
            Year
            <select
              aria-label="Leave year"
              className="wp-input"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {Array.from(
                { length: 12 },
                (_, i) => Number(today.slice(0, 4)) + 1 - i,
              ).map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <button
            className="wp-btn wp-leave-record"
            onClick={() => {
              mutations.create.reset()
              setRecording(true)
            }}
          >
            <Plus size={15} />
            Record leave
          </button>
        </div>
      }
    >
      {leave.isPending || leave.isError ? (
        <WorkerLoading
          error={leave.isError}
          retry={() => void leave.refetch()}
        />
      ) : leave.data.length ? (
        leave.data.map((record) => (
          <div className="wp-leave-row" key={record.id}>
            <div>
              <p>
                {formatDateRange(record.start_date, record.end_date)}
              </p>
              <p className="wp-muted">
                {LEAVE_TYPE_LABELS[record.leave_type]} · {countDays(record)}{' '}
                {countDays(record) === 1 ? 'day' : 'days'} · Recorded
              </p>
              {record.notes && <p className="wp-muted">{record.notes}</p>}
            </div>
            <button
              className="wp-link"
              disabled={mutations.remove.isPending}
              onClick={() => {
                void confirm({
                  title: 'Remove leave record?',
                  description: `${worker.first_name} ${worker.last_name} · ${LEAVE_TYPE_LABELS[record.leave_type]} · ${formatDateRange(record.start_date, record.end_date)}. Unresolved shifts will still need cover, and replacement workers will remain assigned. Review the schedule after removing this record.`,
                  cancelLabel: 'Keep record',
                  confirmLabel: 'Remove leave record',
                  onConfirm: () => mutations.remove.mutateAsync(record.id),
                })
              }}
            >
              Remove
            </button>
          </div>
        ))
      ) : (
        <p className="wp-muted">No leave records starting in {year}.</p>
      )}
      {mutations.remove.isError && (
        <p role="alert" className="wp-error">
          {errorMessage(mutations.remove.error)}
        </p>
      )}
    </WorkerPanel>
  )
  return (
    <>
      <div className="wp-section-heading wp-between">
        <div>
          <h2>Attendance & time away.</h2>
          <p className="wp-muted">
            Shift outcomes and recorded leave, in one place.
          </p>
        </div>
        <div className="wp-row">
          <label className="wp-period">
            View
            <select
              className="wp-input"
              aria-label="Attendance view"
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'month' | 'year')}
            >
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </label>
          {period === 'month' ? (
            <label className="wp-period">
              Shift period
              <input
                className="wp-input"
                type="month" max={MAX_INPUT_MONTH}
                value={month}
                onChange={(e) => {
                  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))
                    setMonth(e.target.value)
                }}
              />
            </label>
          ) : (
            <label className="wp-period">
              Shift year
              <select
                className="wp-input"
                aria-label="Shift year"
                value={month.slice(0, 4)}
                onChange={(e) => setMonth(`${e.target.value}-01`)}
              >
                {Array.from(
                  { length: 12 },
                  (_, i) => Number(today.slice(0, 4)) + 1 - i,
                ).map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
      {section === 'leave' && (
        <div style={{ marginBottom: 26 }}>{leavePanel}</div>
      )}
      {visits.isPending || visits.isError ? (
        <WorkerLoading
          error={visits.isError}
          retry={() => void visits.refetch()}
        />
      ) : (
        <AttendanceSummary stats={stats} />
      )}
      <div className="wp-stack">
        {section !== 'leave' && leavePanel}
        <WorkerPanel
          title={period === 'year' ? 'Monthly breakdown' : "Shift outcomes"}
          action={
            <span className="wp-muted">
              {dateLabel(
                `${month}-01`,
                period === 'year' ? 'yyyy' : 'MMMM yyyy',
              )}
            </span>
          }
        >
          {visits.isPending || visits.isError ? (
            <WorkerLoading
              error={visits.isError}
              retry={() => void visits.refetch()}
            />
          ) : period === 'year' ? (
            <WorkerAttendanceReport
              year={Number(month.slice(0, 4))}
              visits={periodVisits}
              onSelectMonth={(value) => {
                setMonth(value)
                setPeriod('month')
              }}
            />
          ) : outcomes.length ? (
            <div className="wp-table-scroll">
              <table className="wp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.map((v) => (
                    <tr key={`${v.shift_id}:${v.date}`}>
                      <td>{dateLabel(v.start_time, 'MMM d')}</td>
                      <td>
                        <button
                          className="wp-link"
                          onClick={() => setSelected(v)}
                        >
                          {v.client.first_name} {v.client.last_name}
                        </button>
                      </td>
                      <td>{v.replacement_shift_id ? 'Replaced — original absence retained' : statusLabels[v.completion_status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="wp-muted">No shift outcomes in this period.</p>
          )}
        </WorkerPanel>
      </div>
      {recording && (
        <RecordLeaveModal
          workerId={worker.id}
          isPending={mutations.create.isPending}
          error={
            mutations.create.isError
              ? errorMessage(mutations.create.error)
              : null
          }
          onClose={() => setRecording(false)}
          onSubmit={(payload) =>
            mutations.create.mutate(payload, {
              onSuccess: () => {
                setRecording(false)
                setYear(Number(payload.start_date.slice(0, 4)))
              },
            })
          }
        />
      )}
      {selected && (
        <ShiftDetailDrawer shift={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
