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
            <th>Completed</th>
            <th>Missed</th>
            <th>Dropped / absent</th><th>Leave</th><th>Other drops</th><th>Cover assigned</th><th>Cover completed</th>
            <th>Cancelled</th>
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
                <td>{stats.completed}</td>
                <td>{stats.missed}</td>
                <td>{stats.dropped}</td><td>{stats.leaveAbsences}</td><td>{stats.otherDrops}</td><td>{stats.replacementAssigned}</td><td>{stats.replacementCompleted}</td>
                <td>{stats.cancelled}</td>
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
