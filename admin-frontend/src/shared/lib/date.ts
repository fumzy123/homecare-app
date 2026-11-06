import { format, parseISO, type Day } from 'date-fns'

/** Calendar dates: never convert through UTC when formatting a date-only value. */
export function formatDateRange(start: string, end: string): string {
  const first = parseISO(start), last = parseISO(end)
  if (start === end) return format(first, 'MMM do, yyyy')
  if (first.getFullYear() !== last.getFullYear())
    return `${format(first, 'MMM do yyyy')} – ${format(last, 'MMM do yyyy')}`
  if (first.getMonth() !== last.getMonth())
    return `${format(first, 'MMM do')} – ${format(last, 'MMM do yyyy')}`
  return `${format(first, 'MMM do')} – ${format(last, 'do yyyy')}`
}

export const WEEK_STARTS_ON: Day = 0 // 0 = Sunday, 1 = Monday

// Bound native date segments to four-digit years so Chromium advances after YYYY.
// Stricter business limits (for example date of birth <= today) take precedence.
export const MAX_INPUT_DATE = '9999-12-31'
export const MAX_INPUT_MONTH = '9999-12'
