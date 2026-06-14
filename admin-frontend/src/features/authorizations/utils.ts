import type { Authorization, HoursPeriod } from './api'

/** The single currently-active authorization, if any. */
export function activeAuthorization(auths: Authorization[]): Authorization | undefined {
  return auths.find((a) => a.status === 'active')
}

/** Sum of authorized hours across an authorization's service lines (in its own period). */
export function totalAuthorizedHours(auth: Authorization): number {
  return auth.services.reduce((sum, s) => sum + s.authorized_hours, 0)
}

/** Whole days from today until the given ISO date (negative if past). */
export function daysUntil(isoDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(isoDate)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/** Human "ends" label for the active authorization's covering window. */
export function endsRelLabel(auth: Authorization): string {
  if (!auth.covering_end) return 'Open-ended'
  const d = daysUntil(auth.covering_end)
  if (d < 0) return 'Expired'
  if (d === 0) return 'Ends today'
  return `${d} day${d === 1 ? '' : 's'} left`
}

/** Compact hours formatting — drop trailing .0. */
export function fmtHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

const PERIOD_NOUN: Record<HoursPeriod, string> = {
  per_week: 'weekly',
  bi_weekly: 'bi-weekly',
  per_month: 'monthly',
}

export function periodNoun(period: HoursPeriod): string {
  return PERIOD_NOUN[period]
}

/**
 * Group historical (non-active) authorizations by their authorization number so
 * an amendment pile-up reads as a lineage. Returns the same flat list, newest
 * first, each annotated with a version number within its lineage.
 */
export function withLineageVersions(
  auths: Authorization[],
): (Authorization & { version: number })[] {
  const byNumber = new Map<string, Authorization[]>()
  for (const a of auths) {
    const bucket = byNumber.get(a.authorization_number) ?? []
    bucket.push(a)
    byNumber.set(a.authorization_number, bucket)
  }
  // Oldest covering_start = v1 within each lineage.
  const versionOf = new Map<string, number>()
  for (const bucket of byNumber.values()) {
    bucket
      .slice()
      .sort((a, b) => a.covering_start.localeCompare(b.covering_start))
      .forEach((a, i) => versionOf.set(a.id, i + 1))
  }
  return auths
    .slice()
    .sort((a, b) => b.covering_start.localeCompare(a.covering_start))
    .map((a) => ({ ...a, version: versionOf.get(a.id) ?? 1 }))
}
