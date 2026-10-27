import { format, startOfWeek, endOfWeek, isSameMonth, isSameYear } from 'date-fns'
import { WEEK_STARTS_ON } from '@/shared/lib/date'

export function ScheduleToolbar({ date, view, workersView, onNavigate, onView }: {
  date: Date
  view: 'week' | 'month'
  workersView: boolean
  onNavigate: (direction: 'previous' | 'next' | 'today') => void
  onView: (view: 'week' | 'month') => void
}) {
  const start = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })
  const end = endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })
  let label: string
  if (view === 'month') {
    label = format(date, 'MMMM yyyy')
  } else if (isSameMonth(start, end)) {
    label = `${format(start, 'MMM do')} – ${format(end, 'do yyyy')}`
  } else if (isSameYear(start, end)) {
    label = `${format(start, 'MMM do')} – ${format(end, 'MMM do yyyy')}`
  } else {
    label = `${format(start, 'MMM do yyyy')} – ${format(end, 'MMM do yyyy')}`
  }
  const button = 'rounded-full border border-ink/40 font-mono hover:bg-cream-2 hover:border-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
  const arrowButton = `${button} w-8 h-8 flex items-center justify-center text-[13px] text-ink`
  const pillButton = `${button} px-3.5 py-1.5 text-[10px] tracking-[0.05em] uppercase`
  return <div className="schedule-toolbar flex flex-wrap items-center gap-3 px-4 py-3 border-b border-ink bg-paper shrink-0">
    <div className="schedule-toolbar-nav">
      <button type="button" aria-label={`Previous ${view}`} className={arrowButton} onClick={() => onNavigate('previous')}>←</button>
      <span className="font-serif text-[20px]" aria-live="polite">{label}</span>
      <button type="button" aria-label={`Next ${view}`} className={arrowButton} onClick={() => onNavigate('next')}>→</button>
    </div>
    <button type="button" className={`${pillButton} text-ink`} onClick={() => onNavigate('today')}>Today</button>
    {!workersView && <div className="flex gap-2" role="group" aria-label="Calendar period">
      {(['week', 'month'] as const).map(period => <button type="button" key={period} aria-pressed={view === period}
        className={`${pillButton} ${view === period ? 'bg-ink text-cream hover:bg-ink' : 'text-ink'}`} onClick={() => onView(period)}>
        {period === 'week' ? 'Week' : 'Month'}
      </button>)}
    </div>}
  </div>
}
