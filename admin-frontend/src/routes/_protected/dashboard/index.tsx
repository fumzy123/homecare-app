import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format, startOfWeek, endOfWeek, subDays, addDays } from 'date-fns'
import { Users, UserRound, CalendarDays, AlertCircle } from 'lucide-react'
import { clientsApi } from '@/features/clients/api'
import { workersApi } from '@/features/workers/api'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'

export const Route = createFileRoute('/_protected/dashboard/')({
  component: DashboardPage,
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = format(new Date(), 'yyyy-MM-dd')
const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd')
const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd')
const droppedFrom = format(subDays(new Date(), 7), 'yyyy-MM-dd')
const droppedTo = format(addDays(new Date(), 60), 'yyyy-MM-dd')

function statusPillClass(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':  return 'bg-green-50 text-green-700'
    case 'cancelled':  return 'bg-red-50 text-red-600'
    case 'no_show':    return 'bg-amber-50 text-amber-700'
    case 'dropped':    return 'bg-orange-50 text-orange-600'
    default:           return 'bg-gray-100 text-gray-600'
  }
}

function statusLabel(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':  return 'Completed'
    case 'cancelled':  return 'Cancelled'
    case 'no_show':    return 'No Show'
    case 'dropped':    return 'Dropped'
    default:           return 'Scheduled'
  }
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ElementType
  sub?: string
}

function StatCard({ label, value, icon: Icon, sub }: StatCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className="rounded-md bg-gray-100 p-1.5 text-gray-600">
          <Icon size={15} />
        </div>
      </div>
      <p className="text-3xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.listClients(),
  })

  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.listWorkers,
  })

  const { data: todayShifts = [], isLoading: loadingToday } = useQuery({
    queryKey: ['shifts', today, today],
    queryFn: () => shiftsApi.listShifts(today, today),
  })

  const { data: weekShifts = [] } = useQuery({
    queryKey: ['shifts', weekStart, weekEnd],
    queryFn: () => shiftsApi.listShifts(weekStart, weekEnd),
  })

  const { data: droppedShifts = [] } = useQuery({
    queryKey: ['shifts', droppedFrom, droppedTo, 'dropped'],
    queryFn: () => shiftsApi.listShifts(droppedFrom, droppedTo, undefined, undefined, ['dropped']),
  })

  // ─── Derived stats ───────────────────────────────────────────────────────

  const activeClients = clients.filter((c) => c.status === 'active')
  const activeWorkers = workers.filter((w) => w.is_active)
  const onHoldClients = clients.filter((c) => c.status === 'on_hold')

  const sortedDroppedShifts = [...droppedShifts].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )

  const sortedTodayShifts = [...todayShifts].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )

  return (
    <div className="p-8 flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active Clients"
          value={activeClients.length}
          icon={UserRound}
          sub={onHoldClients.length > 0 ? `${onHoldClients.length} on hold` : undefined}
        />
        <StatCard
          label="Active Workers"
          value={activeWorkers.length}
          icon={Users}
          sub={`of ${workers.length} total`}
        />
        <StatCard
          label="Shifts Today"
          value={todayShifts.length}
          icon={CalendarDays}
          sub={format(new Date(), 'EEEE, MMM d')}
        />
        <StatCard
          label="Shifts This Week"
          value={weekShifts.length}
          icon={CalendarDays}
          sub={`${weekStart} – ${weekEnd}`}
        />
      </div>

      {/* ── Today's schedule + Unassigned clients ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Today's Schedule */}
        <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Today's Schedule</h2>
            <span className="text-xs text-gray-400">{format(new Date(), 'EEEE, MMMM d')}</span>
          </div>

          {loadingToday ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Loading…</p>
          ) : sortedTodayShifts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">No shifts scheduled for today</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {sortedTodayShifts.map((shift) => (
                <button
                  key={`${shift.shift_id}-${shift.date}`}
                  onClick={() => setSelectedShift(shift)}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-28 shrink-0">
                    <p className="text-xs font-medium text-gray-500 tabular-nums">
                      {format(new Date(shift.start_time), 'h:mm a')}
                    </p>
                    <p className="text-xs text-gray-400 tabular-nums">
                      {format(new Date(shift.end_time), 'h:mm a')}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {shift.worker.first_name} {shift.worker.last_name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {shift.client.first_name} {shift.client.last_name}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusPillClass(shift.completion_status)}`}>
                    {statusLabel(shift.completion_status)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Shifts Needing Coverage */}
        <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Shifts Needing Coverage</h2>
            {sortedDroppedShifts.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-orange-600">
                <AlertCircle size={13} />
                {sortedDroppedShifts.length} shift{sortedDroppedShifts.length !== 1 ? 's' : ''} dropped
              </span>
            )}
          </div>

          {sortedDroppedShifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-8 text-center">
              <p className="text-sm font-medium text-green-700">All shifts are covered</p>
              <p className="mt-1 text-xs text-gray-400">No action needed</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sortedDroppedShifts.map((shift) => (
                <div key={`${shift.shift_id}-${shift.date}`} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-24 shrink-0">
                    <p className="text-xs font-medium text-gray-700 tabular-nums">
                      {format(new Date(shift.start_time), 'MMM d')}
                    </p>
                    <p className="text-xs text-gray-400 tabular-nums">
                      {format(new Date(shift.start_time), 'h:mm a')}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {shift.client.first_name} {shift.client.last_name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {shift.worker.first_name} {shift.worker.last_name} dropped
                      {shift.notes ? ` · ${shift.notes}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedShift(shift)}
                    className="shrink-0 rounded-md border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
                  >
                    Assign
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Shift detail drawer */}
      {selectedShift && (
        <ShiftDetailDrawer
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
        />
      )}
    </div>
  )
}
