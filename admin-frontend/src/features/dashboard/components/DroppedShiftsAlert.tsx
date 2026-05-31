import { format } from 'date-fns'
import { Card, Kicker } from '@/shared/components/ui'
import type { ShiftOccurrence } from '@/features/shifts/api'

interface DroppedShiftsAlertProps {
  droppedShifts: ShiftOccurrence[]
  onSelectShift: (shift: ShiftOccurrence) => void
}

export function DroppedShiftsAlert({ droppedShifts, onSelectShift }: DroppedShiftsAlertProps) {
  const sorted = [...droppedShifts].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  if (sorted.length === 0) {
    return (
      <Card className="p-6">
        <Kicker className="mb-2">B / Coverage</Kicker>
        <div className="font-serif text-[22px] leading-none mt-2 mb-1">All shifts covered</div>
        <p className="font-mono text-[10px] text-muted tracking-wide">NO ACTION NEEDED</p>
      </Card>
    )
  }

  return (
    <Card variant="orange" className="p-6">
      <div className="font-mono text-[10px] tracking-[0.15em] opacity-80 mb-2">B / NEEDS ATTENTION</div>
      <div className="font-serif text-[28px] leading-[1.05] mb-3">
        {sorted.length} shift{sorted.length !== 1 ? 's' : ''} dropped
      </div>
      <div className="space-y-3">
        {sorted.slice(0, 2).map((shift) => (
          <div key={`${shift.shift_id}-${shift.date}`} className="text-[12px] opacity-90 leading-snug">
            {format(new Date(shift.start_time), 'EEE MMM d')} · {format(new Date(shift.start_time), 'h:mm a')} – {format(new Date(shift.end_time), 'h:mm a')} · {shift.client.first_name} {shift.client.last_name}
            {shift.notes && <span className="opacity-70"> — {shift.notes}</span>}
          </div>
        ))}
      </div>
      <button
        onClick={() => sorted[0] && onSelectShift(sorted[0])}
        className="mt-5 flex items-center gap-2 px-4 py-2 bg-white text-orange border border-white rounded-full font-mono text-[11px] tracking-wide hover:bg-ink hover:text-cream hover:border-ink transition-all"
      >
        Assign worker →
      </button>
    </Card>
  )
}
