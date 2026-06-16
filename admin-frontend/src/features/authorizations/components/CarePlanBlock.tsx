import { useEffect, useState } from 'react'
import { TimeInput, Kicker } from '@/shared/components/ui'
import { useCareSchedule, useSaveCareSchedule } from '../hooks/useCareSchedule'
import { useAuthorizationCompliance } from '../hooks/useAuthorizations'
import { WEEKDAYS, SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../constants'
import { fmtHours } from '../utils'
import type { CareScheduleBlockInput, ServiceType, WeekDay } from '../api'

const selectClass = 'w-full bg-paper border border-ink px-2 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink appearance-none'

interface Row { day_of_week: WeekDay; start_time: string; end_time: string; service_type: ServiceType }

function blockHours(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60)
}

function errorMessage(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
    ?? 'Failed to save the care plan. Please try again.'
}

function CompliancePill({ over }: { over: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.06em] uppercase px-2 py-0.5 border ${
      over ? 'border-orange bg-orange-soft text-ink' : 'border-mint-dark bg-mint-soft text-ink'
    }`}>
      <span className="dot" style={{ background: over ? 'var(--color-orange)' : 'var(--color-mint-dark)' }} />
      {over ? 'Over cap' : 'Within cap'}
    </span>
  )
}

/**
 * The agency's weekly delivery plan, built directly beneath the authorization
 * hero. Per-service compliance is computed live (planned bi-weekly vs the
 * authorized cap) and saving is hard-blocked while any service is over cap.
 */
export function CarePlanBlock({ clientId, enforceCompliance = true }: { clientId: string; enforceCompliance?: boolean }) {
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

  // The services to show pills for: authorized services + anything planned.
  const pillServices = Array.from(new Set([
    ...(compliance?.services ?? []).map((s) => s.service_type),
    ...rows.map((r) => r.service_type),
  ]))
  const overplanned = pillServices.filter(
    (st) => (plannedBiweekly.get(st) ?? 0) > (authorizedBiweekly.get(st) ?? 0) + 1e-9,
  )
  // Self-pay clients have no funder cap — never flag over cap or block saving.
  const anyOver = enforceCompliance && overplanned.length > 0

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
      {/* header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft gap-4">
        <div>
          <Kicker leader className="mb-1.5">
            {enforceCompliance ? 'Care plan — delivers against the active authorization' : 'Care plan — recurring weekly care'}
          </Kicker>
          <h3 className="font-serif text-[22px] tracking-[-0.02em]">Weekly schedule</h3>
        </div>
        {enforceCompliance && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {pillServices.map((st) => (
              <span key={st} className="inline-flex items-center gap-1.5">
                <span className="font-mono text-[9.5px] text-ink-soft">{SERVICE_TYPE_LABELS[st].split(' ')[0]}</span>
                <CompliancePill over={(plannedBiweekly.get(st) ?? 0) > (authorizedBiweekly.get(st) ?? 0) + 1e-9} />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* table header */}
      <div className="grid grid-cols-[90px_130px_130px_1fr_56px_40px] bg-cream-2 border-b border-line-soft">
        {['Day', 'Start', 'End', 'Service', 'Hrs', ''].map((h, i) => (
          <div key={i} className="px-3 py-2.5 font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">{h}</div>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="px-6 py-6 font-mono text-[10px] text-muted tracking-wide text-center">
          NO BLOCKS YET — ADD WHEN CARE TIMES ARE KNOWN
        </p>
      )}

      {rows.map((r, i) => {
        const hrs = blockHours(r.start_time, r.end_time)
        return (
          <div key={i} className={`grid grid-cols-[90px_130px_130px_1fr_56px_40px] items-center ${i ? 'border-t border-dashed border-line-soft' : ''}`}>
            <div className="px-3 py-2.5">
              <select className={selectClass} value={r.day_of_week} onChange={(e) => update(i, { day_of_week: e.target.value as WeekDay })}>
                {WEEKDAYS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </div>
            <div className="px-3 py-2.5"><TimeInput value={r.start_time} onChange={(v) => update(i, { start_time: v })} /></div>
            <div className="px-3 py-2.5"><TimeInput value={r.end_time} onChange={(v) => update(i, { end_time: v })} /></div>
            <div className="px-3 py-2.5">
              <select className={selectClass} value={r.service_type} onChange={(e) => update(i, { service_type: e.target.value as ServiceType })}>
                {SERVICE_TYPES.map((t) => <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="px-3 py-2.5 font-mono text-[12px] font-semibold">{fmtHours(hrs)}h</div>
            <div className="px-3 py-2.5 text-center">
              <button type="button" onClick={() => removeRow(i)} className="font-mono text-[15px] text-muted hover:text-orange leading-none">✕</button>
            </div>
          </div>
        )
      })}

      {/* footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-line-soft gap-4">
        <button type="button" onClick={addRow}
          className="font-mono text-[10px] tracking-[0.06em] uppercase text-ink-soft hover:text-ink">＋ Add block</button>
        <div className="flex items-center gap-4">
          {saved && <span className="font-mono text-[10px] text-ink-soft">✓ Saved</span>}
          {error && <span className="font-mono text-[10px] text-orange">{error}</span>}
          {enforceCompliance && (
            <span className={`font-mono text-[10px] tracking-[0.04em] uppercase ${anyOver ? 'text-orange' : 'text-mint-dark'}`}>
              ● {anyOver ? `Over cap on ${overplanned.length} service${overplanned.length === 1 ? '' : 's'}` : 'Within cap'}
            </span>
          )}
          <button onClick={handleSave} disabled={isPending || anyOver}
            className="rounded-full border border-ink bg-ink text-cream px-4 py-2 font-mono text-[11px] tracking-[0.03em] hover:bg-orange hover:border-orange transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {isPending ? 'Saving…' : 'Save plan'}
          </button>
        </div>
      </div>
    </div>
  )
}
