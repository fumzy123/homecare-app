import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format, subDays } from 'date-fns'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId/')({
  component: WorkerOverview,
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeHours(start: string, end: string) {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3600000
}

function pillClass(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':  return 'bg-green-50 text-green-700'
    case 'cancelled':  return 'bg-red-50 text-red-600'
    case 'in_progress': return 'bg-blue-50 text-blue-700'
    default:           return 'bg-gray-100 text-gray-600'
  }
}

function pillLabel(status: string) {
  if (status === 'in_progress') return 'In Progress'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

function WorkerOverview() {
  const { workerId } = Route.useParams()

  // All-time stats (wide range covers past + future scheduled shifts)
  const statsFrom = '2020-01-01'
  const statsTo   = '2030-12-31'

  const { data: stats } = useQuery({
    queryKey: ['shift-stats', statsFrom, statsTo, workerId, ''],
    queryFn: () => shiftsApi.getShiftStats(statsFrom, statsTo, workerId),
  })

  // Shift history table — last 90 days, adjustable
  const defaultFrom = format(subDays(new Date(), 90), 'yyyy-MM-dd')
  const defaultTo   = format(new Date(), 'yyyy-MM-dd')
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate,   setToDate]   = useState(defaultTo)
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', fromDate, toDate, workerId, ''],
    queryFn: () => shiftsApi.listShifts(fromDate, toDate, workerId),
  })

  const sorted = [...shifts].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  )

  const upcoming  = (stats?.scheduled ?? 0) + (stats?.in_progress ?? 0)
  const completed = stats?.completed ?? 0
  const cancelled = stats?.cancelled ?? 0

  return (
    <>
      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Upcoming" value={upcoming} sub="scheduled shifts" />
        <StatCard label="Completed" value={completed} sub="all time" />
        <StatCard label="Cancelled" value={cancelled} sub="all time" />
      </div>

      {/* Shift history */}
      <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900 mr-auto">Shift History</h2>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">No shifts in this period</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Client</th>
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
                    {shift.client.first_name} {shift.client.last_name}
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
