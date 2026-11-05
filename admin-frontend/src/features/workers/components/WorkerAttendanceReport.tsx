import { DroppedShiftCount } from './AttendanceSummary'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { attendanceStats, dateLabel } from '../lib/profile'

// Layer 2: yearly reporting from the same effective occurrences as the monthly view.
export function WorkerAttendanceReport({
  year,
  visits,
  onSelectMonth,
}: {
  year: number
  visits: ShiftOccurrence[]
  onSelectMonth: (month: string) => void
}) {
  return (
    <div className="wp-table-scroll">
      <table className="wp-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Dropped shifts</th>
            <th>Replacement cover completed</th>
            <th>Attendance</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }, (_, i) => {
            const month = `${year}-${String(i + 1).padStart(2, '0')}`
            const stats = attendanceStats(
              visits.filter((v) => v.start_time.startsWith(month)),
            )
            const countable = stats.completed + stats.missed
            return (
              <tr key={month}>
                <td>
                  <button
                    className="wp-link"
                    onClick={() => onSelectMonth(month)}
                  >
                    {dateLabel(`${month}-01`, 'MMMM')}
                  </button>
                </td>
                <td><DroppedShiftCount stats={stats} /></td>
                <td>{stats.replacementCompleted}</td>
                <td>
                  {countable
                    ? `${Math.round((100 * stats.completed) / countable)}%`
                    : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
