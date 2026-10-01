import { useId, useState } from 'react'
import { format } from 'date-fns'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { DayTimeline } from '@/features/shifts/components/DayTimeline'
import { Card, Kicker, Pill } from '@/shared/components/ui'

const FILTERS = [
  { status: 'in_progress', label: 'In progress', empty: 'No shifts in progress right now.' },
  { status: 'scheduled', label: 'Upcoming', empty: 'No upcoming shifts today.' },
  { status: 'completed', label: 'Completed', empty: 'No completed shifts today.' },
] as const

type ShiftFilter = typeof FILTERS[number]['status']

interface TodayShiftsTimelineProps {
  shifts: ShiftOccurrence[]
  isLoading: boolean
  onSelectShift: (shift: ShiftOccurrence) => void
}

export function TodayShiftsTimeline({ shifts, isLoading, onSelectShift }: TodayShiftsTimelineProps) {
  const [filter, setFilter] = useState<ShiftFilter>('in_progress')
  const resultsId = useId()
  const visibleShifts = shifts
    .filter((shift) => shift.completion_status === filter)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  const selectedFilter = FILTERS.find((option) => option.status === filter)!

  return (
    <Card className="col-span-2 max-md:col-span-1 min-w-0 p-0">
      <div className="px-6 py-5 border-b border-ink">
        <Kicker className="mb-1">A · Live Timeline</Kicker>
        <h3 className="font-serif text-[26px] leading-none tracking-[-0.02em]">
          Today's shifts <span className="italic text-muted">— {format(new Date(), 'EEE, MMM d')}</span>
        </h3>
      </div>

      <div role="group" aria-label="Filter today's shifts" className="flex flex-wrap gap-2 px-6 py-4 border-b border-line-soft">
        {FILTERS.map(({ status, label }) => (
          <Pill
            key={status}
            type="button"
            variant="ghost"
            active={filter === status}
            aria-pressed={filter === status}
            aria-controls={resultsId}
            onClick={() => setFilter(status)}
          >
            {label}
            <span className="ml-1 opacity-60 tabular-nums">
              {isLoading ? '—' : shifts.filter((shift) => shift.completion_status === status).length}
            </span>
          </Pill>
        ))}
      </div>

      <div id={resultsId} role="region" aria-label={`${selectedFilter.label} shifts`} aria-busy={isLoading}>
        <p className="sr-only" role="status">
          {isLoading ? 'Loading shifts.' : `${visibleShifts.length} ${selectedFilter.label.toLowerCase()} shifts today.`}
        </p>
        {isLoading ? (
          <p className="px-6 py-10 text-center font-mono text-[11px] text-muted tracking-wide">LOADING…</p>
        ) : visibleShifts.length === 0 ? (
          <p className="px-6 py-10 text-center font-mono text-[11px] text-ink-soft">{selectedFilter.empty}</p>
        ) : (
          <DayTimeline
            shifts={visibleShifts}
            onSelectShift={onSelectShift}
            focusTime={filter === 'in_progress' ? undefined : visibleShifts[0].start_time}
          />
        )}
      </div>
    </Card>
  )
}
