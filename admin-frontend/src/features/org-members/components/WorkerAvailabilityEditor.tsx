import { useEffect, useState } from 'react'
import { TimeInput } from '@/shared/components/ui'
import { useWorkerAvailability, useSaveWorkerAvailability } from '../hooks/useWorkerAvailability'
import type { WeekDay, AvailabilityBlockInput } from '../api'

const DAYS: { key: WeekDay; label: string }[] = [
  { key: 'MO', label: 'Mon' }, { key: 'TU', label: 'Tue' }, { key: 'WE', label: 'Wed' },
  { key: 'TH', label: 'Thu' }, { key: 'FR', label: 'Fri' }, { key: 'SA', label: 'Sat' },
  { key: 'SU', label: 'Sun' },
]

// Friendly buckets persisted as canonical time ranges, so storage is always intervals.
const BUCKETS = [
  { key: 'morning',   label: 'Morning',   hint: '6a – 12p',  start: '06:00', end: '12:00' },
  { key: 'afternoon', label: 'Afternoon', hint: '12 – 6p',   start: '12:00', end: '18:00' },
  { key: 'evening',   label: 'Evening',   hint: '6 – 11p',   start: '18:00', end: '23:00' },
  { key: 'overnight', label: 'Overnight', hint: '12 – 6a',   start: '00:00', end: '06:00' },
]

const hhmm = (t: string) => t.slice(0, 5)

interface Row { day_of_week: WeekDay; start_time: string; end_time: string }

function errorMessage(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
    ?? 'Failed to save availability. Please try again.'
}

const selectClass = 'w-full bg-paper border border-ink px-2 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink appearance-none'

export function WorkerAvailabilityEditor({ memberId }: { memberId: string }) {
  const { data: blocks } = useWorkerAvailability(memberId)
  const { mutateAsync: save, isPending } = useSaveWorkerAvailability(memberId)

  const [rows, setRows] = useState<Row[]>([])
  const [exact, setExact] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (blocks) {
      setRows(blocks.map((b) => ({ day_of_week: b.day_of_week, start_time: hhmm(b.start_time), end_time: hhmm(b.end_time) })))
    }
  }, [blocks])

  const touch = () => setSaved(false)

  const hasBucket = (day: WeekDay, b: typeof BUCKETS[number]) =>
    rows.some((r) => r.day_of_week === day && r.start_time === b.start && r.end_time === b.end)

  function toggleBucket(day: WeekDay, b: typeof BUCKETS[number]) {
    setRows((prev) =>
      hasBucket(day, b)
        ? prev.filter((r) => !(r.day_of_week === day && r.start_time === b.start && r.end_time === b.end))
        : [...prev, { day_of_week: day, start_time: b.start, end_time: b.end }],
    )
    touch()
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    touch()
  }
  function addRow() { setRows((prev) => [...prev, { day_of_week: 'MO', start_time: '09:00', end_time: '17:00' }]); touch() }
  function removeRow(i: number) { setRows((prev) => prev.filter((_, idx) => idx !== i)); touch() }

  // Windows that don't line up with a bucket — only editable in exact mode.
  const customCount = rows.filter((r) => !BUCKETS.some((b) => b.start === r.start_time && b.end === r.end_time)).length

  async function handleSave() {
    setError(null); setSaved(false)
    if (rows.some((r) => r.end_time <= r.start_time)) {
      setError('Each window must end after it starts.'); return
    }
    try {
      await save(rows.map<AvailabilityBlockInput>((r) => ({ day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time })))
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const orderedRows = rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => DAYS.findIndex((d) => d.key === a.r.day_of_week) - DAYS.findIndex((d) => d.key === b.r.day_of_week) || a.r.start_time.localeCompare(b.r.start_time))

  return (
    <div className="border border-ink bg-paper">
      <div className="flex items-center justify-between px-5 py-3 border-b border-ink gap-4">
        <div>
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-muted">Weekly availability</p>
          <h3 className="font-serif text-[18px] leading-none tracking-[-0.02em] mt-1">When they can work</h3>
        </div>
        <label className="flex items-center gap-2 cursor-pointer shrink-0">
          <span className="font-mono text-[10px] tracking-[0.06em] uppercase text-ink-soft">Exact hours</span>
          <button type="button" role="switch" aria-checked={exact} onClick={() => setExact((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center border transition-colors ${exact ? 'bg-ink border-ink' : 'bg-cream-2 border-line-soft'}`}>
            <span className={`inline-block h-3 w-3 bg-cream transition-transform ${exact ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </label>
      </div>

      {/* Grid mode */}
      {!exact ? (
        <div className="px-5 py-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-28 pb-2" />
                {DAYS.map((d) => (
                  <th key={d.key} className="pb-2 text-center font-mono text-[10px] tracking-[0.08em] text-ink-soft">{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BUCKETS.map((b) => (
                <tr key={b.key}>
                  <td className="py-1.5 pr-3">
                    <span className="font-mono text-[10px] tracking-[0.05em] text-ink-soft">{b.label}</span>
                    <span className="font-mono text-[9px] text-muted ml-1">{b.hint}</span>
                  </td>
                  {DAYS.map((d) => {
                    const checked = hasBucket(d.key, b)
                    return (
                      <td key={d.key} className="py-1.5 text-center">
                        <button type="button" onClick={() => toggleBucket(d.key, b)} aria-pressed={checked}
                          className={`mx-auto flex h-7 w-7 items-center justify-center transition-colors ${
                            checked ? 'bg-ink text-cream border border-ink' : 'border border-ink/20 bg-cream-2 hover:border-ink/50'
                          }`}>
                          {checked && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {customCount > 0 && (
            <p className="font-mono text-[9px] text-ink-soft mt-3">
              + {customCount} custom window{customCount === 1 ? '' : 's'} — switch on <b>Exact hours</b> to see them.
            </p>
          )}
        </div>
      ) : (
        /* Exact mode */
        <div className="px-5 py-4 flex flex-col gap-2">
          {rows.length === 0 && (
            <p className="font-mono text-[10px] text-muted tracking-wide py-2">NO AVAILABILITY SET</p>
          )}
          {orderedRows.map(({ r, i }) => (
            <div key={i} className="grid grid-cols-[90px_130px_130px_40px] items-center gap-2">
              <select className={selectClass} value={r.day_of_week} onChange={(e) => update(i, { day_of_week: e.target.value as WeekDay })}>
                {DAYS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
              <TimeInput value={r.start_time} onChange={(v) => update(i, { start_time: v })} />
              <TimeInput value={r.end_time} onChange={(v) => update(i, { end_time: v })} />
              <button type="button" onClick={() => removeRow(i)} className="font-mono text-[15px] text-muted hover:text-orange leading-none text-center">✕</button>
            </div>
          ))}
          <button type="button" onClick={addRow}
            className="self-start mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-ink-soft hover:text-ink">＋ Add window</button>
        </div>
      )}

      <div className="flex items-center gap-3 px-5 py-3 border-t border-ink">
        <button type="button" onClick={handleSave} disabled={isPending}
          className="bg-ink text-cream px-4 py-2 font-mono text-[10px] uppercase tracking-[0.06em] hover:bg-orange transition-colors disabled:opacity-40">
          {isPending ? 'Saving…' : 'Save availability'}
        </button>
        {saved && <span className="font-mono text-[10px] text-ink-soft">✓ Saved</span>}
        {error && <span className="font-mono text-[10px] text-orange">{error}</span>}
      </div>
    </div>
  )
}
