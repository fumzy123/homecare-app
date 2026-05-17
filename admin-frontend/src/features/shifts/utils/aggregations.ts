import type { ShiftOccurrence } from '@/features/shifts/api'

export function shiftHours(shift: ShiftOccurrence): number {
  return (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3_600_000
}

export function sumHours(shifts: ShiftOccurrence[]): number {
  return shifts
    .filter(s => !['cancelled', 'dropped'].includes(s.completion_status))
    .reduce((sum, s) => sum + shiftHours(s), 0)
}
