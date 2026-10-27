import { useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useMemo, useRef } from 'react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { format, parse, parseISO, startOfWeek, startOfMonth, endOfMonth, getDay, addDays, addMonths } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { toCalendarEvents, type ShiftOccurrence, type CalendarEvent } from '@/features/shifts/api'
import { useCalendarShifts, useTargetVisit } from '../hooks/useShifts'
import { useWorkers } from '@/features/workers/hooks/useWorkers'
import { useClients } from '@/features/clients/hooks/useClients'
import { CreateShiftDrawer, type PendingShiftInfo } from '@/features/shifts/components/CreateShiftDrawer'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'
import { WorkersSchedule } from './WorkersSchedule'
import { ScheduleToolbar } from './ScheduleToolbar'
import { buildWorkerRows, calendarWeekWidth, visitTimeLabel } from '../lib/workerSchedule'
import '../schedule.css'
import { STATUS_TOKENS, getStatusToken } from '@/shared/lib/shiftStatus'

// ─── Localizer ────────────────────────────────────────────────────────────────

const localizer = dateFnsLocalizer({
  format, parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON }),
  getDay,
  locales: { 'en-US': enUS },
})

// ─── Range helper ─────────────────────────────────────────────────────────────

function rangeForView(date: Date, view: View) {
  if (view === 'month') {
    return { from: format(startOfMonth(date), 'yyyy-MM-dd'), to: format(endOfMonth(date), 'yyyy-MM-dd') }
  }
  const ws = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })
  return { from: format(ws, 'yyyy-MM-dd'), to: format(addDays(ws, 6), 'yyyy-MM-dd') }
}

// ─── Calendar sub-components ──────────────────────────────────────────────────

function WeekHeader({ date }: { date: Date }) {
  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  return (
    <div className="px-3 py-3 text-left">
      <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft leading-none">{format(date, 'EEE')}</p>
      <p className="font-serif text-[30px] leading-none font-medium mt-1 text-ink">{format(date, 'd')}</p>
      {isToday && (
        <span className="mt-2 inline-block font-mono text-[8px] tracking-[0.1em] uppercase border border-ink px-1.5 py-0.5 text-ink">Today</span>
      )}
    </div>
  )
}

function MonthHeader({ label }: { label: string }) {
  return <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft px-2 py-2">{label}</p>
}

function CalendarVisit({ event }: { event: CalendarEvent }) {
  if (event.resource.shift_id === '__phantom__') return <span>{event.title}</span>
  const { client, worker } = event.resource
  return <>
    <span className="schedule-visit-time">{visitTimeLabel(event.resource)}</span>
    <span className="schedule-visit-client">{client.first_name} {client.last_name}</span>
    <span className="schedule-visit-worker">{worker.first_name} {worker.last_name}</span>
  </>
}

// ─── Overtime computation ─────────────────────────────────────────────────────

const OVERTIME_THRESHOLD = 40
const OT_COLOR = '#D88989'

function computeOvertimeMap(occurrences: ShiftOccurrence[]): Map<string, number> {
  const map = new Map<string, number>()
  const active = occurrences.filter(o => !['cancelled', 'dropped'].includes(o.completion_status))

  const groups = new Map<string, ShiftOccurrence[]>()
  for (const o of active) {
    const d = new Date(o.start_time)
    const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())
    const key = `${o.worker.id}:${format(sunday, 'yyyy-MM-dd')}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(o)
  }

  for (const group of groups.values()) {
    group.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    let cumulative = 0
    for (const o of group) {
      const duration = (new Date(o.end_time).getTime() - new Date(o.start_time).getTime()) / 3_600_000
      const occKey = `${o.shift_id}:${o.date}`
      if (cumulative >= OVERTIME_THRESHOLD) {
        map.set(occKey, 1)
      } else if (cumulative + duration > OVERTIME_THRESHOLD) {
        map.set(occKey, (cumulative + duration - OVERTIME_THRESHOLD) / duration)
      }
      cumulative += duration
    }
  }

  return map
}

// ─── ShiftCalendar ────────────────────────────────────────────────────────────

interface ShiftCalendarProps {
  showNewShiftDrawer?: boolean
  onNewShiftDrawerClose?: () => void
  initialWorkerId?: string
  initialClientId?: string
  initialDate?: string
  targetShiftId?: string
  targetOccurrence?: string
}

export function ShiftCalendar({ showNewShiftDrawer = false, onNewShiftDrawerClose, initialWorkerId, initialClientId, initialDate, targetShiftId, targetOccurrence }: ShiftCalendarProps) {
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate]     = useState(() => initialDate ? parseISO(initialDate) : new Date())
  const [view, setView]                   = useState<'week' | 'month'>('week')
  const [scheduleView, setScheduleView] = useState<'calendar' | 'workers'>('calendar')
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeView = scheduleView === 'workers' ? 'week' : view
  const [showDrawer, setShowDrawer]       = useState(false)
  const [pendingShift, setPendingShift]   = useState<PendingShiftInfo | null>(null)
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)
  const [filterWorkerId, setFilterWorkerId] = useState(initialWorkerId ?? '')
  const [filterClientId, setFilterClientId] = useState(initialClientId ?? '')
  const [targetDismissed, setTargetDismissed] = useState(false)

  const [prevShowNewShift, setPrevShowNewShift] = useState(showNewShiftDrawer)
  if (showNewShiftDrawer && prevShowNewShift !== showNewShiftDrawer) {
    setPrevShowNewShift(true)
    setPendingShift(null)
    setShowDrawer(true)
  }
  if (!showNewShiftDrawer && prevShowNewShift) {
    setPrevShowNewShift(false)
  }

  const { from, to } = rangeForView(currentDate, activeView)

  const { data: occurrences = [], isLoading, isError, refetch } = useCalendarShifts(from, to, filterWorkerId, filterClientId)
  const { data: workers = [], isLoading: workersLoading, isError: workersError, refetch: refetchWorkers } = useWorkers()
  const { data: clients = [] } = useClients()
  const targetQuery = useTargetVisit(targetDismissed ? undefined : targetShiftId, targetOccurrence)
  const target = !targetDismissed ? targetQuery.data : undefined
  const displayedShift = selectedShift ?? target

  const overtimeMap = useMemo(
    () => activeView === 'week' ? computeOvertimeMap(occurrences) : new Map<string, number>(),
    [occurrences, activeView],
  )

  const workerRows = useMemo(() => buildWorkerRows(
    workers.filter(worker => !filterWorkerId || worker.id === filterWorkerId), occurrences, from,
  ), [workers, filterWorkerId, occurrences, from])
  const weekWidth = useMemo(() => calendarWeekWidth(occurrences, from), [occurrences, from])
  const loading = isLoading || (scheduleView === 'workers' && workersLoading)
  const failed = isError || (scheduleView === 'workers' && workersError)

  const baseEvents   = toCalendarEvents(occurrences)
  const phantomEvent = showDrawer && pendingShift
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

  const navigate = (direction: 'previous' | 'next' | 'today') => {
    setCurrentDate(date => direction === 'today' ? new Date()
      : activeView === 'month' ? addMonths(date, direction === 'next' ? 1 : -1)
      : addDays(date, direction === 'next' ? 7 : -7))
    scrollRef.current?.scrollTo({ left: 0 })
  }

  const inputClass = 'bg-paper border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

  return (
    <>
      {targetShiftId && !targetDismissed && !targetQuery.isPending && !target && <p role="status" className="mx-10 mb-4 border border-line-soft p-3 text-sm">{targetQuery.isError ? 'Could not load this visit. Refresh to try again.' : 'This visit is no longer available. Review the schedule for its current status.'}</p>}
      {/* Shared view selection and filters */}
      <div className="px-10 max-md:px-4 mb-4 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Schedule view" className="flex border border-ink">
          {(['calendar', 'workers'] as const).map(mode => <button type="button" key={mode}
            aria-pressed={scheduleView === mode} onClick={() => { setScheduleView(mode); scrollRef.current?.scrollTo({ left: 0 }) }}
            className={`px-4 py-2 font-mono text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${scheduleView === mode ? 'bg-ink text-cream' : 'bg-paper hover:bg-cream-2'}`}>
            {mode === 'calendar' ? 'Calendar' : 'Workers'}
          </button>)}
        </div>
        <select aria-label="Filter by worker" value={filterWorkerId} onChange={(e) => setFilterWorkerId(e.target.value)} className={inputClass + ' max-sm:flex-1 min-w-[120px]'}>
          <option value="">All workers</option>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
        </select>
        <select aria-label="Filter by client" value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)} className={inputClass + ' max-sm:flex-1 min-w-[120px]'}>
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div className="px-10 max-md:px-4 pb-4 flex flex-wrap items-center gap-4 max-md:gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">
        {(['scheduled', 'in_progress', 'completed', 'no_show', 'cancelled', 'dropped'] as const).map((key) => {
          const t = STATUS_TOKENS[key]
          return (
            <span key={key} className="flex items-center gap-2">
              <span style={{ width: 14, height: 14, background: t.bg, border: `1px ${t.dashed ? 'dashed' : 'solid'} ${t.border}`, display: 'inline-block', flexShrink: 0 }} />
              {t.label}
            </span>
          )
        })}
        {scheduleView === 'calendar' && view === 'week' && (
          <span className="flex items-center gap-2">
            <span style={{ width: 14, height: 14, background: `linear-gradient(to bottom, #FFE2D4 50%, ${OT_COLOR} 50%)`, border: '1px solid #111111', display: 'inline-block', flexShrink: 0 }} />
            Overtime
          </span>
        )}
      </div>

      {/* Calendar */}
      <div className="relative min-h-[500px] flex-1 px-10 max-md:px-4 pb-10">
        <div className="relative h-full border border-ink overflow-hidden bg-paper flex flex-col">
          <ScheduleToolbar date={currentDate} view={activeView} workersView={scheduleView === 'workers'} onNavigate={navigate} onView={setView} />
          {failed && <div role="alert" className="p-4 border-b border-ink text-sm">
            Could not load the schedule. <button type="button" className="underline" onClick={() => { void refetch(); void refetchWorkers() }}>Retry</button>
          </div>}
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-cream/80">
              <p className="font-mono text-[11px] text-muted tracking-wide">LOADING SHIFTS…</p>
            </div>
          )}
          {!failed && <div ref={scrollRef} className="schedule-scroll" role="region" tabIndex={0}
            aria-label={scheduleView === 'workers' ? 'Worker schedule, scroll horizontally through the week' : 'Calendar, scroll horizontally through the week'}
            aria-busy={loading}>
          {scheduleView === 'workers' ? (!loading && <WorkersSchedule rows={workerRows} from={from} clientFiltered={!!filterClientId} onSelect={visit => handleSelectEvent({ resource: visit })} />) : <div className="schedule-calendar" style={{ minWidth: view === 'week' ? weekWidth : 700 }}>
          <Calendar
            localizer={localizer}
            events={events}
            showMultiDayTimes={true}
            view={view}
            onView={next => setView(next === 'month' ? 'month' : 'week')}
            date={currentDate}
            onNavigate={setCurrentDate}
            views={['week', 'month']}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable
            toolbar={false}
            dayLayoutAlgorithm="no-overlap"
            tooltipAccessor={event => event.resource.shift_id === '__phantom__' ? event.title : `${visitTimeLabel(event.resource)} · ${event.resource.client.first_name} ${event.resource.client.last_name} · ${event.resource.worker.first_name} ${event.resource.worker.last_name} · ${getStatusToken(event.resource.completion_status).label}`}
            scrollToTime={new Date(1970, 1, 1, 7, 0, 0)}
            style={{ height: '100%' }}
            components={{ event: CalendarVisit, week: { header: WeekHeader }, month: { header: MonthHeader } }}
            eventPropGetter={(event) => {
              if (event.resource?.shift_id === '__phantom__') {
                return { style: { background: 'transparent', border: '2px dashed #8A8378', borderRadius: 0, fontSize: 11, padding: '2px 6px', color: '#8A8378', fontFamily: "'JetBrains Mono', monospace" } }
              }
              const rawStatus = event.resource?.completion_status ?? 'scheduled'
              const now = new Date()
              const status =
                rawStatus === 'scheduled' && event.start <= now && now <= event.end
                  ? 'in_progress'
                  : rawStatus
              const m = getStatusToken(status)

              const otFraction = overtimeMap.get(`${event.resource?.shift_id}:${event.resource?.date}`) ?? 0
              let background = m.bg
              let color = m.color
              if (otFraction >= 1) {
                background = OT_COLOR
                color = STATUS_TOKENS.scheduled.color
              } else if (otFraction > 0) {
                const normalPct = Math.round((1 - otFraction) * 100)
                background = `linear-gradient(to bottom, ${m.bg} ${normalPct}%, ${OT_COLOR} ${normalPct}%)`
                color = STATUS_TOKENS.scheduled.color
              }

              return { style: { background, border: `1px ${m.dashed ? 'dashed' : 'solid'} ${m.border}`, borderRadius: 0, color, fontSize: 11, padding: '3px 7px', fontFamily: "'JetBrains Mono', monospace" } }
            }}
            dayPropGetter={(date) => ({
              style: { backgroundColor: format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? '#FFE2D4' : undefined },
            })}
          />
          </div>}
          </div>}
        </div>
      </div>

      {showDrawer && (
        <CreateShiftDrawer
          initialDate={pendingShift?.start ?? null}
          initialEndDate={pendingShift?.end ?? null}
          onFormChange={(info) => setPendingShift(info)}
          onClose={() => { setShowDrawer(false); setPendingShift(null); onNewShiftDrawerClose?.() }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['shifts'] })}
        />
      )}

      {displayedShift && (
        <ShiftDetailDrawer shift={displayedShift} onClose={() => { setSelectedShift(null); setTargetDismissed(true) }} />
      )}
    </>
  )
}

