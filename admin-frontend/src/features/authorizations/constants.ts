import type { ServiceType, HoursPeriod, WeekDay, AuthorizationStatus } from './api'

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  personal_care: 'Personal Care',
  companionship: 'Companionship',
  respite:       'Respite',
  nursing:       'Nursing',
  homemaking:    'Homemaking',
}

export const SERVICE_TYPES: ServiceType[] = [
  'personal_care', 'homemaking', 'respite', 'nursing', 'companionship',
]

export const HOURS_PERIOD_LABELS: Record<HoursPeriod, string> = {
  per_week:  'Weekly',
  bi_weekly: 'Bi-weekly',
  per_month: 'Monthly',
}

export const WEEKDAYS: { key: WeekDay; label: string }[] = [
  { key: 'MO', label: 'Mon' },
  { key: 'TU', label: 'Tue' },
  { key: 'WE', label: 'Wed' },
  { key: 'TH', label: 'Thu' },
  { key: 'FR', label: 'Fri' },
  { key: 'SA', label: 'Sat' },
  { key: 'SU', label: 'Sun' },
]

export const WEEKDAY_LABELS: Record<WeekDay, string> = Object.fromEntries(
  WEEKDAYS.map((d) => [d.key, d.label]),
) as Record<WeekDay, string>

type TagVariant = 'default' | 'mint' | 'yellow' | 'rose'

export const STATUS_TAG: Record<AuthorizationStatus, { variant: TagVariant; label: string }> = {
  active:     { variant: 'mint',    label: 'Active' },
  pending:    { variant: 'yellow',  label: 'Pending' },
  expired:    { variant: 'rose',    label: 'Expired' },
  superseded: { variant: 'default', label: 'Superseded' },
  cancelled:  { variant: 'default', label: 'Cancelled' },
}
