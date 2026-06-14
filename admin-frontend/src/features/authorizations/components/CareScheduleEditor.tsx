import { useEffect, useState } from 'react'
import { TimeInput } from '@/shared/components/ui'
import { useCareSchedule, useSaveCareSchedule } from '../hooks/useCareSchedule'
import { useAuthorizationCompliance } from '../hooks/useAuthorizations'
import { WEEKDAYS, SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../constants'
import type { CareScheduleBlockInput, ServiceType, WeekDay } from '../api'

const selectClass = 'bg-cream border border-ink px-2 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink appearance-none'

interface Row { day_of_week: WeekDay; start_time: string; end_time: string; service_type: ServiceType }

function blockHours(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60)
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { error?: { message?: string } } } })
    ?.response?.data?.error?.message
  return message ?? 'Failed to save the care schedule. Please try again.'
}

export function CareScheduleEditor({ clientId }: { clientId: string }) {
  const { data: blocks } = useCareSchedule(clientId)
  const { data: compliance } = useAuthorizationCompliance(clientId)
  const { mutateAsync: save, isPending } = useSaveCareSchedule(clientId)

  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (blocks) {
      setRows(blocks.map((b) => ({
        day_of_week: b.day_of_week, start_time: b.start_time, end_time: b.end_time, service_type: b.service_type,
      })))
    }
  }, [blocks])

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    setSaved(false)
  }
  function addRow() {
    setRows((prev) => [...prev, { day_of_week: 'MO', start_time: '09:00', end_time: '12:00', service_type: 'personal_care' }])
    setSaved(false)
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
    setSaved(false)
  }

  // Live planned hours (bi-weekly) per service from the current rows.
  const plannedBiweekly = new Map<ServiceType, number>()
  for (const r of rows) {
    plannedBiweekly.set(r.service_type, (plannedBiweekly.get(r.service_type) ?? 0) + blockHours(r.start_time, r.end_time) * 2)
  }
  const authorizedBiweekly = new Map<ServiceType, number>(
    (compliance?.services ?? []).map((s) => [s.service_type, s.authorized_biweekly]),
  )
  const overplanned = [...plannedBiweekly.entries()].filter(
    ([st, planned]) => planned > (authorizedBiweekly.get(st) ?? 0) + 1e-9,
  )

  async function handleSave() {
    setError(null)
    setSaved(false)
    const payload: CareScheduleBlockInput[] = rows.map((r) => ({
      day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time, service_type: r.service_type,
    }))
    try {
      await save(payload)
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="border border-ink bg-paper">
      <div className="flex items-center justify-between px-5 py-3 border-b border-ink">
        <h3 className="font-serif text-[18px] leading-none tracking-[-0.02em]">Care Schedule</h3>
        <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-ink-soft">Weekly plan</span>
      </div>

      <div className="px-5 py-4 flex flex-col gap-2">
        {rows.length === 0 && (
          <p className="font-mono text-[10px] text-muted tracking-wide py-2">NO BLOCKS — ADD WHEN CARE TIMES ARE KNOWN</p>
        )}
        {rows.map((r, i) => {
          const hrs = blockHours(r.start_time, r.end_time)
          return (
            <div key={i} className="flex items-center gap-2">
              <select className={selectClass + ' w-20'} value={r.day_of_week}
                onChange={(e) => update(i, { day_of_week: e.target.value as WeekDay })}>
                {WEEKDAYS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
              <div className="w-28"><TimeInput value={r.start_time} onChange={(v) => update(i, { start_time: v })} /></div>
              <span className="font-mono text-[10px] text-ink-soft">–</span>
              <div className="w-28"><TimeInput value={r.end_time} onChange={(v) => update(i, { end_time: v })} /></div>
              <select className={selectClass + ' flex-1'} value={r.service_type}
                onChange={(e) => update(i, { service_type: e.target.value as ServiceType })}>
                {SERVICE_TYPES.map((t) => <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>)}
              </select>
              <span className="font-mono text-[10px] text-ink-soft w-12 text-right">{fmt(hrs)}h</span>
              <button type="button" onClick={() => removeRow(i)}
                className="font-mono text-[16px] text-ink-soft hover:text-orange leading-none px-1">×</button>
            </div>
          )
        })}

        <button type="button" onClick={addRow}
          className="self-start mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-ink-soft hover:text-ink">
          ＋ Add block
        </button>
      </div>

      {/* Live compliance preview */}
      {overplanned.length > 0 && (
        <div className="px-5 py-3 border-t border-line-soft bg-orange-soft">
          <p className="font-mono text-[10px] tracking-[0.08em] uppercase text-orange mb-1">⚠ Exceeds authorization</p>
          {overplanned.map(([st, planned]) => (
            <p key={st} className="font-mono text-[11px] text-ink">
              {SERVICE_TYPE_LABELS[st]}: {fmt(planned)}h planned vs {fmt(authorizedBiweekly.get(st) ?? 0)}h authorized (bi-weekly)
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 px-5 py-3 border-t border-ink">
        <button onClick={handleSave} disabled={isPending || overplanned.length > 0}
          className="bg-ink text-cream px-4 py-2 font-mono text-[10px] uppercase tracking-[0.06em] hover:bg-orange transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {isPending ? 'Saving…' : 'Save Schedule'}
        </button>
        {saved && <span className="font-mono text-[10px] text-ink-soft">✓ Saved</span>}
        {error && <span className="font-mono text-[10px] text-orange">{error}</span>}
      </div>
      <p className="px-5 pb-3 font-mono text-[9px] tracking-[0.04em] text-ink-soft">
        Compliance is checked over the bi-weekly window against active authorizations.
      </p>
    </div>
  )
}
