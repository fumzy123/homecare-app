import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { shiftsApi, type ShiftOccurrence } from '@/features/shifts/api'
import { ShiftStatusBadge } from '@/shared/components/ui'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import { sumHours } from '@/features/shifts/utils/aggregations'

/** All of a client's shifts over a date range — click a row to open the shift. */
export function ClientShiftsTable({ clientId, from, to, periodLabel }: { clientId: string; from: string; to: string; periodLabel?: string }) {
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)
  const [filterStatus, setFilterStatus]   = useState('')

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', from, to, '', clientId],
    queryFn:  () => shiftsApi.listShifts(from, to, undefined, clientId),
  })

  const filtered  = shifts.filter((s) => !filterStatus || s.completion_status === filterStatus)
  const periodHrs = Math.round(sumHours(filtered))
  const sorted    = [...filtered].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

  return (
    <>
      <div className="border border-ink bg-paper">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink gap-4">
          <h2 className="font-serif text-[22px] leading-none tracking-[-0.02em] shrink-0">
            Care visits{periodLabel && <span className="italic text-muted"> {periodLabel}</span>}
          </h2>
          <div className="flex items-center gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-cream border border-ink px-2 py-1 font-mono text-[10px] tracking-[0.05em] uppercase text-ink focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="no_show">No Show</option>
              <option value="cancelled">Cancelled</option>
              <option value="dropped">Dropped</option>
            </select>
            <span className="font-mono text-[11px] text-ink-soft whitespace-nowrap">
              <span className="text-ink font-bold">{periodHrs}</span>h total
            </span>
          </div>
        </div>

        {isLoading ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">LOADING…</p>
        ) : sorted.length === 0 ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">NO SHIFTS IN THIS PERIOD</p>
        ) : (
          <div className="px-6 py-5">
            <div className="grid grid-cols-5 gap-6 pb-2 border-b border-ink">
              {['Date', 'Worker', 'Time', 'Hours', 'Status'].map((h) => (
                <p key={h} className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">{h}</p>
              ))}
            </div>
            {sorted.map((shift, i) => {
              const hrs = ((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3_600_000).toFixed(1)
              return (
                <div
                  key={`${shift.shift_id}-${shift.date}`}
                  onClick={() => setSelectedShift(shift)}
                  className={`grid grid-cols-5 gap-6 py-3 cursor-pointer hover:bg-cream-2 transition-colors ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}
                >
                  <p className="font-mono text-[11px]">{format(new Date(shift.date), 'MMM d, yyyy')}</p>
                  <p className="text-[12px]">{shift.worker.first_name} {shift.worker.last_name}</p>
                  <p className="font-mono text-[11px] text-ink-soft">
                    {format(new Date(shift.start_time), 'HH:mm')} – {format(new Date(shift.end_time), 'HH:mm')}
                  </p>
                  <p className="font-mono text-[11px]">{hrs}h</p>
                  <ShiftStatusBadge status={shift.completion_status} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedShift && (
        <ShiftDetailDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} />
      )}
    </>
  )
}
