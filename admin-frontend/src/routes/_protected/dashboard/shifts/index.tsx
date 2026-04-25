import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, startOfMonth, endOfMonth, getDay, addDays } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { shiftsApi, toCalendarEvents, type ShiftOccurrence, type CalendarEvent } from '@/features/shifts/api'
import { workersApi } from '@/features/workers/api'
import { clientsApi } from '@/features/clients/api'
import { CreateShiftDrawer, type PendingShiftInfo } from '@/features/shifts/components/CreateShiftDrawer'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import { Kicker, Btn } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/dashboard/shifts/')({
  component: ShiftsPage,
})

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

function rangeForView(date: Date, view: View): { from: string; to: string } {
  if (view === 'month') {
    return {
      from: format(startOfMonth(date), 'yyyy-MM-dd'),
      to:   format(endOfMonth(date),   'yyyy-MM-dd'),
    }
  }
  const ws = startOfWeek(date, { weekStartsOn: 1 })
  return {
    from: format(ws, 'yyyy-MM-dd'),
    to:   format(addDays(ws, 6), 'yyyy-MM-dd'),
  }
}

// Status → color mapping matching the design system
const STATUS_COLORS: Record<string, { bg: string; border: string; color: string; dashed?: boolean }> = {
  completed:   { bg: '#111111',  border: '#111111', color: '#F2EEE5' },
  in_progress: { bg: '#9DE8DC',  border: '#111111', color: '#111111' },
  scheduled:   { bg: '#FFE2D4',  border: '#111111', color: '#111111', dashed: true },
  no_show:     { bg: '#F4D35E',  border: '#111111', color: '#111111' },
  cancelled:   { bg: '#EDE8DC',  border: '#8A8378', color: '#8A8378' },
  dropped:     { bg: '#FF5A1F',  border: '#FF5A1F', color: '#ffffff' },
}

function ShiftsPage() {
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate]   = useState(new Date())
  const [view, setView]                 = useState<View>('week')
  const [showDrawer, setShowDrawer]     = useState(false)
  const [pendingShift, setPendingShift] = useState<PendingShiftInfo | null>(null)
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)
  const [filterWorkerId, setFilterWorkerId] = useState('')
  const [filterClientId, setFilterClientId] = useState('')

  const { from, to } = rangeForView(currentDate, view)

  const { data: occurrences = [], isLoading } = useQuery({
    queryKey: ['shifts', from, to, filterWorkerId, filterClientId],
    queryFn:  () => shiftsApi.listShifts(from, to, filterWorkerId || undefined, filterClientId || undefined),
  })
  const { data: workers = [] } = useQuery({ queryKey: ['workers'], queryFn: workersApi.listWorkers })
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.listClients() })

  const baseEvents = toCalendarEvents(occurrences)

  const phantomEvent: CalendarEvent | null =
    showDrawer && pendingShift
      ? { title: pendingShift.title, start: pendingShift.start, end: pendingShift.end, resource: { shift_id: '__phantom__' } as ShiftOccurrence }
      : null

  const events = phantomEvent ? [...baseEvents, phantomEvent] : baseEvents

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    setPendingShift({ start, end, title: 'New Shift' })
    setSelectedShift(null)
    setShowDrawer(true)
  }, [])

  const handleSelectEvent = useCallback((event: { resource: ShiftOccurrence }) => {
    if (event.resource?.shift_id === '__phantom__') return
    setSelectedShift(event.resource)
    setPendingShift(null)
  }, [])

  const handleRangeChange = useCallback((range: Date[] | { start: Date; end: Date }) => {
    const anchor = Array.isArray(range) ? range[0] : range.start
    setCurrentDate(anchor)
  }, [])

  const inputClass = 'bg-paper border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

  return (
    <div className="min-h-full bg-cream flex flex-col" style={{ height: 'calc(100vh - 89px)' }}>
      {/* Header */}
      <div className="flex shrink-0 items-end justify-between px-10 pt-10 pb-6">
        <div>
          <Kicker leader className="mb-4">04 / Schedule</Kicker>
          <h1 className="font-serif text-[52px] leading-[0.98] font-medium tracking-[-0.02em]">
            {format(currentDate, 'MMMM yyyy')}{' '}
            <span className="font-serif italic text-muted">— schedule</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterWorkerId} onChange={(e) => setFilterWorkerId(e.target.value)} className={inputClass}>
            <option value="">All workers</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
          </select>
          <select value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)} className={inputClass}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </select>
          <Btn variant="orange" onClick={() => { setPendingShift(null); setShowDrawer(true) }}>
            ＊ New shift
          </Btn>
        </div>
      </div>

      {/* Legend */}
      <div className="px-10 pb-4 flex items-center gap-6 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">
        {[
          { label: 'Completed',   color: '#111111' },
          { label: 'In progress', color: '#9DE8DC', border: '#111' },
          { label: 'Scheduled',   color: '#FFE2D4', border: '#111', dashed: true },
          { label: 'Cancelled',   color: '#EDE8DC', border: '#8A8378' },
          { label: 'Dropped',     color: '#FF5A1F' },
        ].map(({ label, color, border, dashed }) => (
          <span key={label} className="flex items-center gap-2">
            <span style={{
              width: 14, height: 14,
              background: color,
              border: `1px ${dashed ? 'dashed' : 'solid'} ${border ?? color}`,
              display: 'inline-block',
              flexShrink: 0,
            }} />
            {label}
          </span>
        ))}
        <span className="ml-auto">＊ click any shift to inspect or edit</span>
      </div>

      {/* Calendar */}
      <div className="relative min-h-0 flex-1 px-10 pb-10">
        <div className="relative h-full border border-ink overflow-hidden bg-paper">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-cream/80">
              <p className="font-mono text-[11px] text-muted tracking-wide">LOADING SHIFTS…</p>
            </div>
          )}
          <Calendar
            localizer={localizer}
            events={events}
            view={view}
            onView={setView}
            date={currentDate}
            onNavigate={setCurrentDate}
            views={['week', 'month']}
            onRangeChange={handleRangeChange}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable
            style={{ height: '100%' }}
            eventPropGetter={(event) => {
              if (event.resource?.shift_id === '__phantom__') {
                return {
                  style: {
                    background: 'transparent',
                    border: '2px dashed #8A8378',
                    borderRadius: 0,
                    fontSize: 11,
                    padding: '2px 6px',
                    color: '#8A8378',
                    fontFamily: "'JetBrains Mono', monospace",
                  },
                }
              }
              const status = event.resource?.completion_status ?? 'scheduled'
              const m = STATUS_COLORS[status] ?? STATUS_COLORS.scheduled
              return {
                style: {
                  background: m.bg,
                  border: `1px ${m.dashed ? 'dashed' : 'solid'} ${m.border}`,
                  borderRadius: 0,
                  color: m.color,
                  fontSize: 11,
                  padding: '3px 7px',
                  fontFamily: "'JetBrains Mono', monospace",
                },
              }
            }}
            dayPropGetter={(date) => ({
              style: {
                backgroundColor:
                  format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                    ? '#FFE2D4'
                    : undefined,
              },
            })}
          />
        </div>
      </div>

      {showDrawer && (
        <CreateShiftDrawer
          initialDate={pendingShift?.start ?? null}
          initialEndDate={pendingShift?.end ?? null}
          onFormChange={(info) => setPendingShift(info)}
          onClose={() => { setShowDrawer(false); setPendingShift(null) }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['shifts'] })}
        />
      )}

      {selectedShift && (
        <ShiftDetailDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} />
      )}
    </div>
  )
}
