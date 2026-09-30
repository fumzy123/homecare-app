import { useId } from 'react'
import { timezoneOptions } from '../timezones'

// Layer 2: reusable field for account setup and agency settings.
export function AgencyTimezoneField({ value, onChange, disabled = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean
}) {
  const id = useId()
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-sm font-semibold">Agency timezone</label>
    <select id={id} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} required
      aria-describedby={`${id}-help`} className="w-full border border-ink bg-cream p-3 text-base text-ink disabled:opacity-60">
      <option value="" disabled>Choose your agency’s timezone</option>
      {timezoneOptions(value).map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
    </select>
    <p id={`${id}-help`} className="text-sm leading-relaxed text-ink-soft">Choose where your agency operates. We suggest your device’s timezone; confirm it is correct. This stays fixed when you travel and determines which month visits count toward.</p>
  </div>
}
