import type { ReactNode } from 'react'
import type { attendanceStats } from '../lib/profile'
import './attendance-summary.css'

// Layer 2: controlled attendance presentation; no fetching or mutations.
function MetricInfo({ label, children }: { label: string; children: ReactNode }) {
  return <details className="attendance-info">
    <summary aria-label={label}>ⓘ</summary>
    <div className="attendance-info-content">{children}</div>
  </details>
}

export function DroppedShiftCount({ stats }: { stats: ReturnType<typeof attendanceStats> }) {
  return <span className="attendance-drop-count">{stats.dropped}
    <MetricInfo label="Dropped shifts breakdown">
      <span>Leave-related: {stats.leaveAbsences}</span>
      <span>Other dropped shifts: {stats.otherDrops}</span>
    </MetricInfo>
  </span>
}

export function AttendanceSummary({ stats }: { stats: ReturnType<typeof attendanceStats> }) {
  const total = stats.completed + stats.missed
  const percent = total ? Math.round(100 * stats.completed / total) : null
  return <div className="wp-statline attendance-summary">
    <div><p className="wp-muted">Completed shifts</p><strong>{stats.completed}</strong></div>
    <div><p className="wp-muted">Missed shifts</p><strong>{stats.missed}</strong></div>
    <div><p className="wp-muted">Dropped shifts</p><strong><DroppedShiftCount stats={stats} /></strong></div>
    <div><p className="wp-muted">Replacement cover completed</p><strong>{stats.replacementCompleted}</strong></div>
    <div>
      <p className="wp-muted">Attendance rate <MetricInfo label="How attendance rate is calculated">
        Completed ÷ (completed + missed shifts). Leave and dropped shifts are excluded.
      </MetricInfo></p>
      <div className="attendance-ring" role="img" aria-label={percent === null ? 'No attendance data' : `Attendance rate: ${percent}%`}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="43" fill="none" stroke="var(--color-cream-2, #e9e5da)" strokeWidth="7" />
          {percent !== null && <circle cx="50" cy="50" r="43" fill="none" stroke="var(--color-ink, #171714)" strokeWidth="7" pathLength="100" strokeDasharray={`${percent} 100`} transform="rotate(-90 50 50)" />}
        </svg>
        <span>{percent === null ? '—' : `${percent}%`}</span>
      </div>
      {percent === null && <p className="wp-muted">No attendance data</p>}
    </div>
  </div>
}
