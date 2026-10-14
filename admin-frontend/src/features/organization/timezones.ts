export function browserTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { return '' }
}

export function validTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.trim() !== value) return false
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
}

// Preserve the registration choice across devices; local input must belong to the same email.
export function registrationTimezone(saved: unknown, local: unknown, device: string): string {
  return [saved, local, device].find(validTimezone) ?? ''
}

export function timezoneOptions(value: string): string[] {
  const supported = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : ['America/St_Johns', 'America/Halifax', 'America/Toronto', 'America/Winnipeg', 'America/Regina', 'America/Edmonton', 'America/Vancouver', 'America/Whitehorse']
  return [...new Set(['UTC', ...supported, ...(value ? [value] : [])])].sort()
}
