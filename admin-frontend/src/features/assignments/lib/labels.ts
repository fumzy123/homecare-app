import { WEEKDAY_LABELS } from '@/features/authorizations/constants'
import type { Assignment } from '../api'

export function slotLabel(assignment: Assignment) {
  return `${WEEKDAY_LABELS[assignment.day_of_week]} · ${assignment.start_time.slice(0, 5)}–${assignment.end_time.slice(0, 5)}`
}
