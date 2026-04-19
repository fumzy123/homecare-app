import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/')({
  component: ClientOverview,
})

// ─── Period ───────────────────────────────────────────────────────────────────

type Period = 'all_time' | 'this_month' | 'last_90'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'all_time',   label: 'All time' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_90',    label: 'Last 90 days' },
]

function getDateRange(period: Period): { from: string; to: string } {
  const today = new Date()
  switch (period) {
    case 'all_time':
      return { from: '2020-01-01', to: '2030-12-31' }
    case 'this_month':
      return {
        from: format(startOfMonth(today), 'yyyy-MM-dd'),
        to:   format(endOfMonth(today),   'yyyy-MM-dd'),
      }
    case 'last_90':
      return {
        from: format(subDays(today, 90), 'yyyy-MM-dd'),
        to:   format(today,              'yyyy-MM-dd'),
      }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeHours(start: string, end: string) {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3600000
}

function pillClass(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':   return 'bg-green-50 text-green-700'
    case 'cancelled':   return 'bg-red-50 text-red-600'
    case 'in_progress': return 'bg-blue-50 text-blue-700'
    default:            return 'bg-gray-100 text-gray-600'
  }
}

function pillLabel(status: string) {
  if (status === 'in_progress') return 'In Progress'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ─── Top workers ──────────────────────────────────────────────────────────────

function TopWorkers({ shifts }: { shifts: ShiftOccurrence[] }) {
  const counts = shifts
    .filter((s) => s.completion_status === 'completed')
    .reduce<Record<string, { name: string; count: number }>>((acc, s) => {
      const id = s.worker.id
      if (!acc[id]) acc[id] = { name: `${s.worker.first_name} ${s.worker.last_name}`, count: 0 }
      acc[id].count++
      return acc
    }, {})

  const top3 = Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  if (top3.length === 0) return null

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Top Workers · Completed visits
      </p>
      <div className="space-y-2.5">
        {top3.map((worker, i) => (
          <div key={worker.name} className="flex items-center gap-3">
            <span className="w-4 text-xs font-semibold text-gray-300">{i + 1}</span>
            <span className="flex-1 text-sm text-gray-700">{worker.name}</span>
            <span className="text-sm font-semibold text-gray-900">{worker.count}</span>
            <span className="text-xs text-gray-400">visits</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

function ClientOverview() {
  const { clientId } = Route.useParams()
  const [period, setPeriod]           = useState<Period>('this_month')
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)

  const { from, to } = getDateRange(period)

  // Stats (includes cancelled which listShifts filters out)
  const { data: stats } = useQuery({
    queryKey: ['shift-stats', from, to, '', clientId],
    queryFn: () => shiftsApi.getShiftStats(from, to, undefined, clientId),
  })

  // Shift list — used for the table and computing hours delivered
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', from, to, '', clientId],
    queryFn: () => shiftsApi.listShifts(from, to, undefined, clientId),
  })

  const sorted = [...shifts].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  )

  const hoursDelivered = shifts
    .filter((s) => s.completion_status === 'completed')
    .reduce((sum, s) => sum + computeHours(s.start_time, s.end_time), 0)

  const upcoming  = (stats?.scheduled ?? 0) + (stats?.in_progress ?? 0)
  const completed = stats?.completed ?? 0
  const cancelled = stats?.cancelled ?? 0

  return (
    <>
      {/* Period toggle */}
      <div className="mb-5 flex items-center gap-1.5">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              period === key
                ? 'bg-gray-900 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatCard label="Upcoming" value={upcoming} sub="scheduled visits" />
        <StatCard label="Completed" value={completed} sub="visits" />
        <StatCard
          label="Hours Delivered"
          value={`${hoursDelivered.toFixed(1)} h`}
          sub="of completed care"
        />
        <StatCard label="Cancelled" value={cancelled} sub="visits" />
      </div>

      {/* Top workers */}
      <TopWorkers shifts={shifts} />

      {/* Shift history */}
      <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Visit History</h2>
        </div>

        {isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">No visits in this period</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Worker</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Time</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Hours</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((shift) => (
                <tr
                  key={`${shift.shift_id}-${shift.date}`}
                  onClick={() => setSelectedShift(shift)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-3 text-gray-700">
                    {format(new Date(shift.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    {shift.worker.first_name} {shift.worker.last_name}
                  </td>
                  <td className="px-5 py-3 text-gray-500 tabular-nums">
                    {format(new Date(shift.start_time), 'h:mm a')} – {format(new Date(shift.end_time), 'h:mm a')}
                  </td>
                  <td className="px-5 py-3 text-gray-700 tabular-nums">
                    {computeHours(shift.start_time, shift.end_time).toFixed(1)} h
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pillClass(shift.completion_status)}`}>
                      {pillLabel(shift.completion_status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selectedShift && (
        <ShiftDetailDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} />
      )}
    </>
  )
}
