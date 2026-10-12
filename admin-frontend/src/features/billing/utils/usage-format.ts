export function usageMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.toUpperCase(), currencyDisplay: 'code' }).format(cents / 100)
}

export function usageDate(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  }).format(new Date(instant))
}

export function visitWallTime(local: string): string {
  // API visits are naive agency-local wall times. Formatting as UTC preserves
  // their clock value, even if the browser's own timezone has a DST gap then.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  }).format(new Date(`${local}Z`))
}
