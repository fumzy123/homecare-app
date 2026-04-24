import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { workersApi } from '@/features/workers/api'
import { clientsApi } from '@/features/clients/api'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'

export const Route = createFileRoute('/_protected/dashboard/timesheet/')({
  component: TimesheetPage,
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateInput(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

function computeHours(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.round((ms / 1000 / 3600) * 100) / 100
}

function exportCsv(rows: ShiftOccurrence[], from: string, to: string) {
  const headers = ['Date', 'Worker', 'Client', 'Start', 'End', 'Hours', 'Status']
  const lines = rows.map((r) => [
    r.date,
    `${r.worker.first_name} ${r.worker.last_name}`,
    `${r.client.first_name} ${r.client.last_name}`,
    format(new Date(r.start_time), 'h:mm a'),
    format(new Date(r.end_time), 'h:mm a'),
    computeHours(r.start_time, r.end_time).toFixed(2),
    r.completion_status,
  ])
  const csv = [headers, ...lines].map((row) => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `timesheet-${from}-to-${to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function statusPillClass(status: string) {
  switch (status.toLowerCase()) {
    case 'completed': return 'bg-green-50 text-green-700'
    case 'cancelled': return 'bg-red-50 text-red-600'
    case 'no_show': return 'bg-amber-50 text-amber-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function statusLabel(status: string) {
  switch (status.toLowerCase()) {
    case 'completed': return 'Completed'
    case 'cancelled': return 'Cancelled'
    case 'no_show': return 'No Show'
    default: return status
  }
}

// ─── Column helper ────────────────────────────────────────────────────────────

const col = createColumnHelper<ShiftOccurrence>()

const columns = [
  col.accessor('date', {
    header: 'Date',
    cell: (info) => format(new Date(info.getValue()), 'MMM d, yyyy'),
    sortingFn: 'alphanumeric',
  }),
  col.accessor((row) => `${row.worker.first_name} ${row.worker.last_name}`, {
    id: 'worker',
    header: 'Worker',
  }),
  col.accessor((row) => `${row.client.first_name} ${row.client.last_name}`, {
    id: 'client',
    header: 'Client',
  }),
  col.accessor('start_time', {
    header: 'Start',
    cell: (info) => format(new Date(info.getValue()), 'h:mm a'),
    enableSorting: false,
  }),
  col.accessor('end_time', {
    header: 'End',
    cell: (info) => format(new Date(info.getValue()), 'h:mm a'),
    enableSorting: false,
  }),
  col.accessor((row) => computeHours(row.start_time, row.end_time), {
    id: 'hours',
    header: 'Hours',
    cell: (info) => `${info.getValue().toFixed(2)} h`,
  }),
  col.accessor('completion_status', {
    header: 'Status',
    cell: (info) => (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusPillClass(info.getValue())}`}>
        {statusLabel(info.getValue())}
      </span>
    ),
  }),
]

// ─── Page ─────────────────────────────────────────────────────────────────────

function TimesheetPage() {
  const weekStart = toDateInput(startOfWeek(new Date(), { weekStartsOn: 0 }))
  const weekEnd   = toDateInput(endOfWeek(new Date(), { weekStartsOn: 0 }))

  const [fromDate, setFromDate]         = useState(weekStart)
  const [toDate, setToDate]             = useState(weekEnd)
  const [filterWorkerId, setFilterWorkerId] = useState('')
  const [filterClientId, setFilterClientId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sorting, setSorting]           = useState<SortingState>([{ id: 'date', desc: false }])
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)

  const TIMESHEET_STATUSES = ['completed', 'no_show', 'cancelled']

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', fromDate, toDate, filterWorkerId, filterClientId, TIMESHEET_STATUSES],
    queryFn: () => shiftsApi.listShifts(fromDate, toDate, filterWorkerId || undefined, filterClientId || undefined, TIMESHEET_STATUSES),
  })

  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.listWorkers,
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.listClients(),
  })

  // Client-side status filter
  const filteredShifts = useMemo(() => {
    if (!filterStatus) return shifts
    return shifts.filter((s) => s.completion_status === filterStatus)
  }, [shifts, filterStatus])

  // Summary stats (completed only)
  const completedRows = useMemo(
    () => filteredShifts.filter((s) => s.completion_status.toLowerCase() === 'completed'),
    [filteredShifts]
  )
  const totalHours = useMemo(
    () => completedRows.reduce((acc, s) => acc + computeHours(s.start_time, s.end_time), 0),
    [completedRows]
  )

  const table = useReactTable({
    data: filteredShifts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const inputClass = 'rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-8 pb-5 pt-8">
        <h1 className="text-2xl font-semibold text-gray-900">Timesheet</h1>
        <button
          onClick={() => exportCsv(filteredShifts, fromDate, toDate)}
          disabled={filteredShifts.length === 0}
          className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-8 pb-5">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <select value={filterWorkerId} onChange={(e) => setFilterWorkerId(e.target.value)} className={inputClass}>
          <option value="">All workers</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>
          ))}
        </select>
        <select value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)} className={inputClass}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputClass}>
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="no_show">No Show</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto px-8 pb-8">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <p className="px-6 py-10 text-center text-sm text-gray-400">Loading…</p>
          ) : filteredShifts.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-gray-400">No shifts found for this period</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-gray-100 bg-gray-50">
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 select-none
                          ${header.column.getCanSort() ? 'cursor-pointer hover:text-gray-900' : ''}
                        `}
                      >
                        <span className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="text-gray-300">
                              {{ asc: '↑', desc: '↓' }[header.column.getIsSorted() as string] ?? '↕'}
                            </span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-50">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedShift(row.original)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-gray-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Summary row */}
          {filteredShifts.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500">
                {filteredShifts.length} shift{filteredShifts.length !== 1 ? 's' : ''}
                {filterStatus === '' && completedRows.length !== filteredShifts.length
                  ? ` · ${completedRows.length} completed`
                  : ''}
              </p>
              <p className="text-xs font-semibold text-gray-700">
                {totalHours.toFixed(2)} hrs completed
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {selectedShift && (
        <ShiftDetailDrawer
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
        />
      )}
    </div>
  )
}
