import type { Day } from 'date-fns'

export const WEEK_STARTS_ON: Day = 0 // 0 = Sunday, 1 = Monday

// Bound native date segments to four-digit years so Chromium advances after YYYY.
// Stricter business limits (for example date of birth <= today) take precedence.
export const MAX_INPUT_DATE = '9999-12-31'
export const MAX_INPUT_MONTH = '9999-12'
