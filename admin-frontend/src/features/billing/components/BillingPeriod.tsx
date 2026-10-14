import { usageDate } from '../utils/usage-format'

// Layer 2: readable period dates with precise boundaries available on demand.
export function BillingPeriod({ startsAt, endsAt, timezone }: {
  startsAt: string; endsAt: string; timezone: string
}) {
  const dates = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric',
  }).formatRange(new Date(startsAt), new Date(endsAt))

  return <div className="rounded-xl border border-line-soft bg-cream/60 p-4 sm:p-5">
    <p className="text-sm font-medium text-ink-soft">Billing period</p>
    <p className="mt-1 text-xl font-semibold leading-relaxed text-ink sm:text-2xl">{dates}</p>
    <details className="mt-3 text-sm">
      <summary className="w-fit cursor-pointer rounded-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">View exact times</summary>
      <div className="mt-3 space-y-3 border-t border-line-soft pt-3">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-ink-soft">Starts</dt><dd className="mt-1"><time dateTime={startsAt}>{usageDate(startsAt, timezone)}</time></dd></div>
          <div><dt className="text-ink-soft">Ends</dt><dd className="mt-1"><time dateTime={endsAt}>{usageDate(endsAt, timezone)}</time></dd></div>
        </dl>
        <p className="text-ink-soft">Agency timezone: <span className="break-words">{timezone.replaceAll('_', ' ')}</span>. Visits starting exactly at the end belong to the next period.</p>
      </div>
    </details>
  </div>
}
