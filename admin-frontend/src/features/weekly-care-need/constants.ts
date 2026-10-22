import type { WeekDay } from './types'

export const WEEKDAYS: { key: WeekDay; label: string }[] = [
  { key: 'SU', label: 'Sun' },
  { key: 'MO', label: 'Mon' },
  { key: 'TU', label: 'Tue' },
  { key: 'WE', label: 'Wed' },
  { key: 'TH', label: 'Thu' },
  { key: 'FR', label: 'Fri' },
  { key: 'SA', label: 'Sat' },
]

export const WEEKDAY_LABELS: Record<WeekDay, string> = Object.fromEntries(
  WEEKDAYS.map((d) => [d.key, d.label]),
) as Record<WeekDay, string>
