import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, Navigate, type View, type ToolbarProps } from 'react-big-calendar'
import { format, parse, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay, addDays } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { shiftsApi, toCalendarEvents, type ShiftOccurrence, type CalendarEvent } from '@/features/shifts/api'
import { workersApi } from '@/features/workers/api'
import { clientsApi } from '@/features/clients/api'
import { CreateShiftDrawer, type PendingShiftInfo } from '@/features/shifts/components/CreateShiftDrawer'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import { Kicker, Btn } from '@/shared/components/ui'
import { STATUS_TOKENS, getStatusToken } from '@/shared/lib/shiftStatus'

export const Route = createFileRoute('/_protected/dashboard/shifts/')({
  component: ShiftsPage,
})

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON }),
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
  const ws = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })
  return {
    from: format(ws, 'yyyy-MM-dd'),
    to:   format(addDays(ws, 6), 'yyyy-MM-dd'),
  }
}


function WeekHeader({ date }: { date: Date }) {
  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  return (
    <div className="px-3 py-3 text-left">
      <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft leading-none">
        {format(date, 'EEE')}
      </p>
      <p className="font-serif text-[30px] leading-none font-medium mt-1 text-ink">
        {format(date, 'd')}
      </p>
      {isToday && (
        <span className="mt-2 inline-block font-mono text-[8px] tracking-[0.1em] uppercase border border-ink px-1.5 py-0.5 text-ink">
          Today
        </span>
      )}
    </div>
  )
}

function MonthHeader({ label }: { label: string }) {
  return (
    <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft px-2 py-2">
      {label}
    </p>
  )
}

function CustomToolbar({ date, view, onNavigate, onView }: ToolbarProps) {
  const ws = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })
  const we = endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })

  let label: string
  if (view === 'week') {
    if (format(ws, 'MMMM yyyy') === format(we, 'MMMM yyyy')) {
      label = `${format(ws, 'MMMM d')} – ${format(we, 'd, yyyy')}`
    } else if (format(ws, 'yyyy') === format(we, 'yyyy')) {
      label = `${format(ws, 'MMMM d')} – ${format(we, 'MMMM d, yyyy')}`
    } else {
      label = `${format(ws, 'MMMM d, yyyy')} – ${format(we, 'MMMM d, yyyy')}`
    }
  } else {
    label = format(date, 'MMMM yyyy')
  }

  const navBtn = 'w-8 h-8 rounded-full border border-ink/40 flex items-center justify-center font-mono text-[13px] text-ink hover:bg-cream-2 hover:border-ink transition-colors'

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-ink bg-paper">
      {/* Left: nav group */}
      <div className="flex items-center gap-3 flex-1">
        <button onClick={() => onNavigate(Navigate.PREVIOUS)} className={navBtn}>←</button>
        <span className="font-serif text-[20px] leading-none tracking-[-0.01em]">
          {label}
        </span>
        <button onClick={() => onNavigate(Navigate.NEXT)} className={navBtn}>→</button>
      </div>

      {/* Right: Today + view toggle */}
      <button
        onClick={() => onNavigate(Navigate.TODAY)}
        className="px-4 py-1.5 rounded-full border border-ink/40 hover:border-ink font-mono text-[10px] tracking-[0.05em] uppercase text-ink hover:bg-cream-2 transition-colors"
      >
        Today
      </button>
      <div className="w-px h-5 bg-ink/20 mx-1" />
      {(['week', 'month'] as View[]).map((v) => (
        <button key={v} onClick={() => onView(v)}
          className={`px-3.5 py-1.5 rounded-full font-mono text-[10px] tracking-[0.05em] uppercase transition-colors border ${
            view === v ? 'bg-ink text-cream border-ink' : 'border-ink/40 text-ink hover:border-ink hover:bg-cream-2'
          }`}>
          {v}
        </button>
      ))}
    </div>
  )
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
    queryFn:  () => shiftsApi.listShifts(from, to, filterWorkerId || undefined, filterClientId || undefined, ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'dropped']),
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
          <Btn variant="ghost" onClick={() => { setPendingShift(null); setShowDrawer(true) }}>
            ＊ New shift
          </Btn>
        </div>
      </div>

      {/* Legend — driven by STATUS_TOKENS so colours stay in sync automatically */}
      <div className="px-10 pb-4 flex items-center gap-6 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">
        {(['scheduled', 'in_progress', 'completed', 'no_show', 'cancelled', 'dropped'] as const).map((key) => {
          const t = STATUS_TOKENS[key]
          return (
            <span key={key} className="flex items-center gap-2">
              <span style={{
                width: 14, height: 14,
                background: t.bg,
                border: `1px ${t.dashed ? 'dashed' : 'solid'} ${t.border}`,
                display: 'inline-block',
                flexShrink: 0,
              }} />
              {t.label}
            </span>
          )
        })}
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
            showMultiDayTimes={true}
            view={view}
            onView={setView}
            date={currentDate}
            onNavigate={setCurrentDate}
            views={['week', 'month']}
            onRangeChange={handleRangeChange}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable
            scrollToTime={new Date(1970, 1, 1, 7, 0, 0)}
            style={{ height: '100%' }}
            components={{
              toolbar: CustomToolbar,
              week:    { header: WeekHeader },
              month:   { header: MonthHeader },
            }}
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
              const m = getStatusToken(status)
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
