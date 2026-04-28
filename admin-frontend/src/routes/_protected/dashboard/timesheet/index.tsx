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
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { workersApi } from '@/features/workers/api'
import { clientsApi } from '@/features/clients/api'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import { Card, Kicker, Btn, ShiftStatusBadge, DateInput } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/dashboard/timesheet/')({
  component: TimesheetPage,
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateInput(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

const NON_BILLABLE = new Set(['no_show', 'cancelled'])

function computeHours(start: string, end: string, status?: string): number {
  if (status && NON_BILLABLE.has(status)) return 0
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
    computeHours(r.start_time, r.end_time, r.completion_status).toFixed(2),
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


// ─── Column helper ────────────────────────────────────────────────────────────

const col = createColumnHelper<ShiftOccurrence>()

const columns = [
  col.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span className="font-mono text-[11px]">
        {format(new Date(info.getValue()), 'MMM d, yyyy')}
      </span>
    ),
  }),
  col.accessor((row) => `${row.worker.first_name} ${row.worker.last_name}`, {
    id: 'worker',
    header: 'Worker',
    cell: (info) => <span className="text-[13px] font-medium">{info.getValue()}</span>,
  }),
  col.accessor((row) => `${row.client.first_name} ${row.client.last_name}`, {
    id: 'client',
    header: 'Client',
    cell: (info) => <span className="text-[13px]">{info.getValue()}</span>,
  }),
  col.accessor('start_time', {
    header: 'Start',
    cell: (info) => <span className="font-mono text-[11px] text-ink-soft">{format(new Date(info.getValue()), 'h:mm a')}</span>,
    enableSorting: false,
  }),
  col.accessor('end_time', {
    header: 'End',
    cell: (info) => <span className="font-mono text-[11px] text-ink-soft">{format(new Date(info.getValue()), 'h:mm a')}</span>,
    enableSorting: false,
  }),
  col.accessor((row) => computeHours(row.start_time, row.end_time, row.completion_status), {
    id: 'hours',
    header: 'Hours',
    cell: (info) => (
      <span className="font-mono text-[12px] font-semibold tabular-nums">
        {info.getValue().toFixed(2)} h
      </span>
    ),
  }),
  col.accessor('completion_status', {
    header: 'Status',
    cell: (info) => <ShiftStatusBadge status={info.getValue()} />,
  }),
]

// ─── Page ─────────────────────────────────────────────────────────────────────

function TimesheetPage() {
  const weekStart = toDateInput(startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON }))
  const weekEnd   = toDateInput(endOfWeek(new Date(),   { weekStartsOn: WEEK_STARTS_ON }))

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

  const { data: workers = [] } = useQuery({ queryKey: ['workers'], queryFn: workersApi.listWorkers })
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.listClients() })

  const filteredShifts = useMemo(() => {
    if (!filterStatus) return shifts
    return shifts.filter((s) => s.completion_status === filterStatus)
  }, [shifts, filterStatus])

  const completedRows = useMemo(
    () => filteredShifts.filter((s) => s.completion_status === 'completed'),
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

  const inputClass = 'bg-paper border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

  return (
    <div className="min-h-full bg-cream flex flex-col">
      {/* Header */}
      <div className="flex items-end justify-between max-md:flex-col max-md:items-start gap-4 px-10 max-md:px-4 pt-10 max-md:pt-6 pb-6">
        <div>
          <Kicker leader className="mb-4">05 / Timesheets</Kicker>
          <h1 className="font-serif text-[52px] max-md:text-[32px] leading-[0.98] font-medium tracking-[-0.02em]">
            Timesheets{' '}
            <span className="font-serif italic text-muted">— payroll record</span>
          </h1>
        </div>
        <Btn
          variant="ghost"
          onClick={() => exportCsv(filteredShifts, fromDate, toDate)}
          disabled={filteredShifts.length === 0}
        >
          <Download size={14} />
          Export CSV
        </Btn>
      </div>

      {/* Filters */}
      <div className="px-10 max-md:px-4 pb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">From</label>
          <DateInput value={fromDate} onChange={setFromDate} />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">To</label>
          <DateInput value={toDate} onChange={setToDate} />
        </div>
        <select value={filterWorkerId} onChange={(e) => setFilterWorkerId(e.target.value)} className={inputClass}>
          <option value="">All workers</option>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
        </select>
        <select value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)} className={inputClass}>
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputClass}>
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="no_show">No Show</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 px-10 max-md:px-4 pb-12">
        <Card className="p-0">
          {isLoading ? (
            <p className="px-6 py-10 text-center font-mono text-[11px] text-muted tracking-wide">LOADING…</p>
          ) : filteredShifts.length === 0 ? (
            <p className="px-6 py-10 text-center font-mono text-[11px] text-muted tracking-wide">NO SHIFTS FOR THIS PERIOD</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="bg-ink border-b border-ink">
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                          className={`px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-cream/80 select-none ${
                            header.column.getCanSort() ? 'cursor-pointer hover:text-cream' : ''
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="text-muted">
                                {{ asc: '↑', desc: '↓' }[header.column.getIsSorted() as string] ?? '↕'}
                              </span>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row, i) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedShift(row.original)}
                      className={`cursor-pointer hover:bg-cream-2 transition-colors ${
                        i > 0 ? 'border-t border-dashed border-line-soft' : ''
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3.5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary footer */}
          {filteredShifts.length > 0 && (
            <div className="flex items-center justify-between border-t border-ink px-4 py-3">
              <p className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.08em]">
                {filteredShifts.length} shift{filteredShifts.length !== 1 ? 's' : ''}
                {filterStatus === '' && completedRows.length !== filteredShifts.length
                  ? ` · ${completedRows.length} completed`
                  : ''}
              </p>
              <p className="font-mono text-[12px] font-semibold text-ink">
                {totalHours.toFixed(2)} hrs completed
              </p>
            </div>
          )}
        </Card>
      </div>

      {selectedShift && (
        <ShiftDetailDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} />
      )}
    </div>
  )
}
