import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, startOfMonth, endOfMonth, getDay, addDays } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { shiftsApi, toCalendarEvents, type ShiftOccurrence } from '@/features/shifts/api'
import { CreateShiftDrawer } from '@/features/shifts/components/CreateShiftDrawer'
import { ShiftDetailDrawer } from '@/features/shifts/components/ShiftDetailDrawer'

export const Route = createFileRoute('/_protected/dashboard/shifts/')({
  component: ShiftsPage,
})

// ─── date-fns localizer ───────────────────────────────────────────────────────

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rangeForView(date: Date, view: View): { from: string; to: string } {
  if (view === 'month') {
    return {
      from: format(startOfMonth(date), 'yyyy-MM-dd'),
      to: format(endOfMonth(date), 'yyyy-MM-dd'),
    }
  }
  const weekStart = startOfWeek(date, { weekStartsOn: 0 })
  return {
    from: format(weekStart, 'yyyy-MM-dd'),
    to: format(addDays(weekStart, 6), 'yyyy-MM-dd'),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ShiftsPage() {
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<View>('week')
  const [showDrawer, setShowDrawer] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null)
  const [selectedShift, setSelectedShift] = useState<ShiftOccurrence | null>(null)

  const { from, to } = rangeForView(currentDate, view)

  const { data: occurrences = [], isLoading } = useQuery({
    queryKey: ['shifts', from, to],
    queryFn: () => shiftsApi.listShifts(from, to),
  })

  const events = toCalendarEvents(occurrences)

  const handleSelectSlot = useCallback(({ start }: { start: Date }) => {
    setSelectedSlot(start)
    setSelectedShift(null)
    setShowDrawer(true)
  }, [])

  const handleSelectEvent = useCallback((event: { resource: ShiftOccurrence }) => {
    setSelectedShift(event.resource)
    setSelectedSlot(null)
  }, [])

  const handleRangeChange = useCallback(
    (range: Date[] | { start: Date; end: Date }) => {
      const anchor = Array.isArray(range) ? range[0] : range.start
      setCurrentDate(anchor)
    },
    []
  )

  return (
    <div className="flex flex-col p-8">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Shifts</h1>
        <button
          onClick={() => { setSelectedSlot(null); setShowDrawer(true) }}
          className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          <Plus size={16} />
          New Shift
        </button>
      </div>


      {/* Calendar — fixed height so it fills the viewport regardless of scroll container */}
      <div className="relative rounded-xl border border-gray-200 bg-white p-1 shadow-sm" style={{ height: 'calc(100vh - 140px)' }}>
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70">
            <p className="text-sm text-gray-500">Loading shifts…</p>
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
          eventPropGetter={() => ({
            style: {
              backgroundColor: '#111827',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              padding: '2px 6px',
            },
          })}
          dayPropGetter={(date) => ({
            style: {
              backgroundColor:
                format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ? '#f9fafb'
                  : undefined,
            },
          })}
        />
      </div>

      {/* Create drawer */}
      {showDrawer && (
        <CreateShiftDrawer
          initialDate={selectedSlot}
          onClose={() => setShowDrawer(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['shifts'] })}
        />
      )}

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
