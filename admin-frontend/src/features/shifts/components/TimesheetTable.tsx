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
import { format } from 'date-fns'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { useTimesheetShifts } from '../hooks/useTimesheetShifts'
import { useWorkers } from '@/features/workers/hooks/useWorkers'
import { useClients } from '@/features/clients/hooks/useClients'
import { exportTimesheetView, filterTimesheetStatus } from '../utils/timesheet'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import { Card, ShiftStatusBadge, DateInput, Btn } from '@/shared/components/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NON_BILLABLE = new Set(['no_show', 'cancelled'])

function computeHours(start: string, end: string, status?: string): number {
  if (status && NON_BILLABLE.has(status)) return 0
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.round((ms / 1000 / 3600) * 100) / 100
}

// ─── Column definitions ────────────────────────────────────────────────────────

const col = createColumnHelper<ShiftOccurrence>()

const columns = [
  col.accessor('date', {
    header: 'Date',
    cell: (info) => <span className="font-mono text-[11px]">{format(new Date(info.getValue()), 'MMM d, yyyy')}</span>,
  }),
  col.accessor((row) => `${row.worker.first_name} ${row.worker.last_name}`, {
    id: 'worker', header: 'Worker',
    cell: (info) => <span className="text-[13px] font-medium">{info.getValue()}</span>,
  }),
  col.accessor((row) => `${row.client.first_name} ${row.client.last_name}`, {
    id: 'client', header: 'Client',
    cell: (info) => <span className="text-[13px]">{info.getValue()}</span>,
  }),
  col.accessor('start_time', {
    header: 'Start', enableSorting: false,
    cell: (info) => <span className="font-mono text-[11px] text-ink-soft">{format(new Date(info.getValue()), 'h:mm a')}</span>,
  }),
  col.accessor('end_time', {
    header: 'End', enableSorting: false,
    cell: (info) => <span className="font-mono text-[11px] text-ink-soft">{format(new Date(info.getValue()), 'h:mm a')}</span>,
  }),
  col.accessor((row) => computeHours(row.start_time, row.end_time, row.completion_status), {
    id: 'hours', header: 'Hours',
    cell: (info) => <span className="font-mono text-[12px] font-semibold tabular-nums">{info.getValue().toFixed(2)} h</span>,
  }),
  col.accessor('completion_status', {
    header: 'Status',
    cell: (info) => <ShiftStatusBadge status={info.getValue()} />,
  }),
]

// ─── Component ────────────────────────────────────────────────────────────────

interface TimesheetTableProps {
  fromDate: string
  toDate: string
  onFromChange: (v: string) => void
  onToChange:   (v: string) => void
}

export function TimesheetTable({ fromDate, toDate, onFromChange, onToChange }: TimesheetTableProps) {
  const [filterWorkerId, setFilterWorkerId] = useState('')
  const [filterClientId, setFilterClientId] = useState('')
  const [filterStatus, setFilterStatus]     = useState('')
  const [sorting, setSorting]               = useState<SortingState>([{ id: 'date', desc: false }])
  const [selectedShift, setSelectedShift]   = useState<ShiftOccurrence | null>(null)
  const [exportError, setExportError] = useState(false)
  const query = useTimesheetShifts(fromDate, toDate, filterWorkerId, filterClientId)
  const { data: shifts = [] } = query
  const { data: workers = [] } = useWorkers()
  const { data: clients = [] } = useClients()

  const filteredShifts = useMemo(() => filterTimesheetStatus(shifts, filterStatus), [shifts, filterStatus])

  const completedRows = useMemo(() => filteredShifts.filter((s) => s.completion_status === 'completed'), [filteredShifts])
  const totalHours    = useMemo(() => completedRows.reduce((acc, s) => acc + computeHours(s.start_time, s.end_time), 0), [completedRows])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredShifts, columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const inputClass = 'bg-paper border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'
  const visibleRows = table.getRowModel().rows
  const exportDisabled = query.isPending || query.isFetching || query.isError || visibleRows.length === 0

  function exportVisibleRows() {
    if (exportDisabled) return
    setExportError(false)
    try {
      exportTimesheetView(table, fromDate, toDate)
    } catch {
      setExportError(true)
    }
  }

  return (
    <>
      {/* Filters */}
      <div className="px-10 max-md:px-4 pb-6 flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft shrink-0">From</label>
            <DateInput value={fromDate} max={toDate} onChange={(v) => { onFromChange(v); if (v > toDate) onToChange(v) }} />
          </div>
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft shrink-0">To</label>
            <DateInput value={toDate} min={fromDate} onChange={onToChange} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 flex-1 w-full sm:w-auto">
          <select aria-label="Filter by worker" value={filterWorkerId} onChange={(e) => setFilterWorkerId(e.target.value)} className={inputClass + ' flex-1 min-w-[120px]'}>
            <option value="">All workers</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
          </select>
          <select aria-label="Filter by client" value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)} className={inputClass + ' flex-1 min-w-[120px]'}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </select>
          <select aria-label="Filter by status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputClass + ' flex-1 min-w-[120px]'}>
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="no_show">No Show</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <Btn variant="ghost" onClick={exportVisibleRows} disabled={exportDisabled}>
          <Download size={14} /> Export filtered CSV
        </Btn>
      </div>
      <p className="px-10 max-md:px-4 pb-4 text-sm text-ink-soft">Export includes the current date, worker, client, and status filters, in the displayed sort order.</p>
      {query.isFetching && !query.isPending && <p role="status" className="px-10 pb-4 text-sm">Refreshing shifts… Export will be available when the refresh finishes.</p>}
      {exportError && <p role="alert" className="px-10 pb-4 text-sm text-orange">Could not download the CSV. Please try again.</p>}

      {/* Table */}
      <div className="flex-1 px-10 max-md:px-4 pb-12">
        <Card className="p-0">
          {query.isPending ? (
            <p className="px-6 py-10 text-center font-mono text-[11px] text-muted tracking-wide">LOADING…</p>
          ) : query.isError ? (
            <div role="alert" className="px-6 py-10 text-center"><p>Could not load shifts. Export is unavailable.</p><button className="underline mt-2" onClick={() => void query.refetch()}>Retry</button></div>
          ) : filteredShifts.length === 0 ? (
            <p className="px-6 py-10 text-center font-mono text-[11px] text-muted tracking-wide">NO SHIFTS MATCH THESE FILTERS</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="bg-ink border-b border-ink">
                      {hg.headers.map((header) => (
                        <th key={header.id} onClick={header.column.getToggleSortingHandler()}
                          className={`px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-cream/80 select-none ${header.column.getCanSort() ? 'cursor-pointer hover:text-cream' : ''}`}>
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
                  {visibleRows.map((row, i) => (
                    <tr key={row.id} onClick={() => setSelectedShift(row.original)}
                      className={`cursor-pointer hover:bg-cream-2 transition-colors ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}>
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

          {!query.isError && !query.isPending && filteredShifts.length > 0 && (
            <div className="flex items-center justify-between border-t border-ink px-4 py-3">
              <p className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.08em]">
                {filteredShifts.length} shift{filteredShifts.length !== 1 ? 's' : ''}
                {filterStatus === '' && completedRows.length !== filteredShifts.length ? ` · ${completedRows.length} completed` : ''}
              </p>
              <p className="font-mono text-[12px] font-semibold text-ink">{totalHours.toFixed(2)} scheduled hrs · completed visits</p>
            </div>
          )}
        </Card>
      </div>

      {selectedShift && <ShiftDetailDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} hideEdit />}
    </>
  )
}

