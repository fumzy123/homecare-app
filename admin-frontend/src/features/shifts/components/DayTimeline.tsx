import { format } from 'date-fns'
import { Avatar } from '@/shared/components/ui'
import type { ShiftOccurrence } from '@/features/shifts/api'

// Timeline window: 06:00 – 21:00 (15 hours)
const START_HOUR = 6
const END_HOUR   = 21
const SPAN       = END_HOUR - START_HOUR
const HOURS      = Array.from({ length: SPAN + 1 }, (_, i) => START_HOUR + i)

const AVATAR_COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const

function toDecimalHour(iso: string): number {
  const d = new Date(iso)
  return d.getHours() + d.getMinutes() / 60
}

function pct(hour: number): string {
  const clamped = Math.max(START_HOUR, Math.min(END_HOUR, hour))
  return `${((clamped - START_HOUR) / SPAN) * 100}%`
}

function widthPct(startHour: number, endHour: number): string {
  const s = Math.max(START_HOUR, startHour)
  const e = Math.min(END_HOUR, endHour)
  return `${((e - s) / SPAN) * 100}%`
}

const STATUS_STYLE: Record<string, {
  bg: string; color: string; border: string; borderStyle: string
}> = {
  completed:   { bg: '#111111', color: '#F2EEE5', border: '#111111', borderStyle: 'solid' },
  in_progress: { bg: '#9DE8DC', color: '#111111', border: '#111111', borderStyle: 'solid' },
  scheduled:   { bg: '#FFE2D4', color: '#111111', border: '#111111', borderStyle: 'dashed' },
  no_show:     { bg: '#F4D35E', color: '#111111', border: '#111111', borderStyle: 'solid' },
  cancelled:   { bg: '#EDE8DC', color: '#8A8378', border: '#8A8378', borderStyle: 'dashed' },
  dropped:     { bg: '#FF5A1F', color: '#ffffff', border: '#FF5A1F', borderStyle: 'solid' },
}

interface DayTimelineProps {
  shifts: ShiftOccurrence[]
  onSelectShift: (shift: ShiftOccurrence) => void
}

export function DayTimeline({ shifts, onSelectShift }: DayTimelineProps) {
  // Group shifts by worker id, preserving first-seen order
  const workerOrder: string[] = []
  const byWorker: Record<string, ShiftOccurrence[]> = {}
  for (const s of shifts) {
    const wid = s.worker.id ?? s.shift_id
    if (!byWorker[wid]) { byWorker[wid] = []; workerOrder.push(wid) }
    byWorker[wid].push(s)
  }

  // Current time indicator
  const nowHour = toDecimalHour(new Date().toISOString())
  const showNow = nowHour >= START_HOUR && nowHour <= END_HOUR

  return (
    <div className="overflow-x-auto">
      {/* Hour ruler */}
      <div className="flex border-b border-ink" style={{ paddingLeft: 148 }}>
        {HOURS.map((h) => (
          <div
            key={h}
            className="flex-1 font-mono text-[10px] text-ink-soft py-2 pl-1 border-l border-line-faint first:border-l-0"
            style={{ minWidth: 0 }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Worker rows */}
      <div className="relative">
        {/* NOW line */}
        {showNow && (
          <div
            className="absolute top-0 bottom-0 z-10 pointer-events-none"
            style={{ left: `calc(148px + ${pct(nowHour)} * (100% - 148px) / 100 * 100)` }}
          >
            {/* Simpler: use inline style with calc */}
            <div
              className="absolute top-0 bottom-0 w-px bg-orange"
              style={{ left: 0 }}
            />
            <div className="absolute -top-0 left-1 bg-orange text-white font-mono text-[9px] px-1.5 py-0.5 whitespace-nowrap">
              NOW · {format(new Date(), 'HH:mm')}
            </div>
          </div>
        )}

        {workerOrder.length === 0 && (
          <p className="px-6 py-10 text-center font-mono text-[11px] text-muted tracking-wide">
            NO SHIFTS TODAY
          </p>
        )}

        {workerOrder.map((wid, wi) => {
          const workerShifts = byWorker[wid]
          const worker = workerShifts[0].worker
          const initials = `${worker.first_name[0]}${worker.last_name[0]}`
          const color = AVATAR_COLORS[wi % AVATAR_COLORS.length]

          return (
            <div
              key={wid}
              className={`flex items-center ${wi > 0 ? 'border-t border-dashed border-line-soft' : ''}`}
              style={{ minHeight: 64 }}
            >
              {/* Worker label */}
              <div className="flex items-center gap-2.5 shrink-0 px-4" style={{ width: 148 }}>
                <Avatar initials={initials} color={color} />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium leading-snug truncate">
                    {worker.first_name} {worker.last_name}
                  </p>
                  <p className="font-mono text-[9px] text-orange">
                    {worker.id.slice(0, 6).toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Timeline track */}
              <div className="relative flex-1 self-stretch" style={{ minWidth: 0 }}>
                {/* Hour column lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-l border-line-faint"
                    style={{ left: `${((h - START_HOUR) / SPAN) * 100}%` }}
                  />
                ))}

                {/* Shift blocks */}
                {workerShifts.map((shift) => {
                  const startH = toDecimalHour(shift.start_time)
                  const endH   = toDecimalHour(shift.end_time)
                  const s = STATUS_STYLE[shift.completion_status] ?? STATUS_STYLE.scheduled

                  return (
                    <button
                      key={`${shift.shift_id}-${shift.date}`}
                      onClick={() => onSelectShift(shift)}
                      className="absolute top-2 bottom-2 flex items-center overflow-hidden transition-all hover:-translate-x-px hover:-translate-y-px"
                      style={{
                        left: `calc(${pct(startH)} + 2px)`,
                        width: `calc(${widthPct(startH, endH)} - 4px)`,
                        background: s.bg,
                        color: s.color,
                        border: `1px ${s.borderStyle} ${s.border}`,
                        boxShadow: undefined,
                      }}
                      title={`${shift.client.first_name} ${shift.client.last_name}`}
                    >
                      <span
                        className="px-2 font-mono text-[10px] leading-snug whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{ color: s.color }}
                      >
                        {format(new Date(shift.start_time), 'HH:mm')}
                        {' → '}
                        {format(new Date(shift.end_time), 'HH:mm')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
