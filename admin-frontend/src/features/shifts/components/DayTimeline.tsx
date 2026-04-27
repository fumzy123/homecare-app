import { format } from 'date-fns'
import { Avatar } from '@/shared/components/ui'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { getStatusToken } from '@/shared/lib/shiftStatus'

const START_HOUR = 0
const END_HOUR   = 24
const SPAN       = END_HOUR - START_HOUR
const HOURS      = Array.from({ length: SPAN }, (_, i) => START_HOUR + i)
const LABEL_W    = 168
const ROW_H      = 76
const RULER_H    = 36                   // explicit height shared by both columns
const MIN_TRACK_W = SPAN * 60          // 60px per hour = 1440px for full day

const AVATAR_COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const

function toDecimalHour(iso: string): number {
  const d = new Date(iso)
  return d.getHours() + d.getMinutes() / 60
}

function trackPct(hour: number): number {
  return ((Math.max(START_HOUR, Math.min(END_HOUR, hour)) - START_HOUR) / SPAN) * 100
}

function trackWidthPct(startHour: number, endHour: number): number {
  return ((Math.min(END_HOUR, endHour) - Math.max(START_HOUR, startHour)) / SPAN) * 100
}

interface DayTimelineProps {
  shifts: ShiftOccurrence[]
  onSelectShift: (shift: ShiftOccurrence) => void
}

export function DayTimeline({ shifts, onSelectShift }: DayTimelineProps) {
  const workerOrder: string[] = []
  const byWorker: Record<string, ShiftOccurrence[]> = {}
  for (const s of shifts) {
    const wid = s.worker.id ?? s.shift_id
    if (!byWorker[wid]) { byWorker[wid] = []; workerOrder.push(wid) }
    byWorker[wid].push(s)
  }

  const nowHour = toDecimalHour(new Date().toISOString())
  const showNow = nowHour >= START_HOUR && nowHour <= END_HOUR
  const nowPct  = trackPct(nowHour)

  return (
    <div className="flex">

      {/* ── Sticky label column ── */}
      <div className="shrink-0 border-r border-line-faint" style={{ width: LABEL_W }}>
        {/* Ruler spacer — exact same height as the ruler row */}
        <div className="border-b border-ink" style={{ height: RULER_H }} />

        {workerOrder.length === 0 && (
          <div style={{ height: ROW_H }} />
        )}

        {workerOrder.map((wid, wi) => {
          const workerShifts = byWorker[wid]
          const worker       = workerShifts[0].worker
          const firstClient  = workerShifts[0].client
          const initials     = `${worker.first_name[0]}${worker.last_name[0]}`
          const color        = AVATAR_COLORS[wi % AVATAR_COLORS.length]
          return (
            <div
              key={wid}
              className={`flex items-center gap-2.5 px-4 ${wi > 0 ? 'border-t border-dashed border-line-soft' : ''}`}
              style={{ height: ROW_H }}
            >
              <Avatar initials={initials} color={color} />
              <div className="min-w-0">
                <p className="text-[12px] font-medium leading-snug truncate">
                  {worker.first_name} {worker.last_name}
                </p>
                <p className="text-[11px] text-ink-soft leading-snug truncate">
                  {firstClient.first_name} {firstClient.last_name}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Scrollable track ── */}
      <div className="timeline-scroll flex-1">
        <div style={{ minWidth: MIN_TRACK_W }}>

          {/* Hour ruler — explicit height matches label spacer */}
          <div className="flex border-b border-ink" style={{ height: RULER_H }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="flex-1 font-mono text-[10px] text-ink-soft flex items-center pl-1 border-l border-line-faint first:border-l-0"
              >
                {h === 0 ? '12am' : h < 12 ? `${h}` : h === 12 ? '12pm' : `${h}`}
              </div>
            ))}
          </div>

          {/* Track rows */}
          <div className="relative">

            {/* NOW line */}
            {showNow && (
              <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none"
                style={{ left: `${nowPct}%` }}
              >
                <div className="absolute top-0 bottom-0 w-px bg-orange" />
                <div className="absolute top-0 left-1 bg-orange text-white font-mono text-[9px] px-1.5 py-0.5 whitespace-nowrap">
                  NOW · {format(new Date(), 'HH:mm')}
                </div>
              </div>
            )}

            {workerOrder.length === 0 && (
              <p className="py-10 text-center font-mono text-[11px] text-muted tracking-wide">
                NO SHIFTS TODAY
              </p>
            )}

            {workerOrder.map((wid, wi) => {
              const workerShifts = byWorker[wid]
              return (
                <div
                  key={wid}
                  className={`relative ${wi > 0 ? 'border-t border-dashed border-line-soft' : ''}`}
                  style={{ height: ROW_H }}
                >
                  {/* Hour grid lines */}
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
                    const s      = getStatusToken(shift.completion_status)
                    return (
                      <button
                        key={`${shift.shift_id}-${shift.date}`}
                        onClick={() => onSelectShift(shift)}
                        className="absolute top-3 bottom-3 overflow-hidden transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#111111]"
                        style={{
                          left:    `calc(${trackPct(startH)}% + 2px)`,
                          width:   `calc(${trackWidthPct(startH, endH)}% - 4px)`,
                          background: '#F2EEE5',
                          border:  `1px ${s.dashed ? 'dashed' : 'solid'} ${s.border}`,
                          padding: '3px',
                        }}
                      >
                        <div
                          className="w-full h-full flex items-center overflow-hidden"
                          style={{ background: s.bg }}
                        >
                          <span
                            className="px-2 font-mono text-[10px] leading-snug whitespace-nowrap overflow-hidden text-ellipsis"
                            style={{ color: s.color }}
                          >
                            {format(new Date(shift.start_time), 'HH:mm')}
                            {' → '}
                            {format(new Date(shift.end_time), 'HH:mm')}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}
