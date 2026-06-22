import { useEffect, useState } from 'react'
import { TimeInput, Kicker, ProgressBar } from '@/shared/components/ui'
import { useWeeklyCarePlan, useSaveWeeklyCarePlan } from '../hooks/useWeeklyCarePlan'
import { useAuthorizationCompliance } from '@/features/authorizations/hooks/useAuthorizations'
import { WEEKDAYS, SERVICE_TYPES, SERVICE_TYPE_LABELS } from '@/features/authorizations/constants'
import { fmtHours } from '@/features/authorizations/utils'
import type { WeeklyCarePlanEntryInput } from '../api'
import type { ServiceType, WeekDay } from '@/features/authorizations/api'

// We need a class for inputs in the table to match the square box design from the screenshot
const inputClass = 'w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink transition-colors'
const selectClass = `${inputClass} appearance-none`

interface Row { day_of_week: WeekDay; start_time: string; end_time: string; service_type: ServiceType }

function entryHours(start: string, end: string): number {
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
 * The client's weekly care plan — the recurring entries of care we intend to
 * deliver. When `enforceCompliance` is set (funded clients), per-service
 * compliance is computed live (planned weekly vs the authorized cap) and
 * saving is hard-blocked while any service is over cap.
 */
export function WeeklyCarePlanEditor({ clientId, enforceCompliance = true }: { clientId: string; enforceCompliance?: boolean }) {
  const { data: entries } = useWeeklyCarePlan(clientId)
  const { data: compliance } = useAuthorizationCompliance(clientId)
  const { mutateAsync: save, isPending } = useSaveWeeklyCarePlan(clientId)

  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (entries) {
      setRows(entries.map((e) => ({
        day_of_week: e.day_of_week, start_time: e.start_time, end_time: e.end_time, service_type: e.service_type,
      })))
    }
  }, [entries])

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    setSaved(false)
  }
  function addRow() {
    setRows((prev) => [...prev, { day_of_week: 'MO', start_time: '09:00', end_time: '17:00', service_type: 'personal_care' }])
    setSaved(false)
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
    setSaved(false)
  }

  // Live planned hours (per week) per service from the current rows.
  // The schedule defines a single week, so rows directly equal weekly planned hours.
  const plannedWeekly = new Map<ServiceType, number>()
  for (const r of rows) {
    plannedWeekly.set(r.service_type, (plannedWeekly.get(r.service_type) ?? 0) + entryHours(r.start_time, r.end_time))
  }
  
  // Authorized hours come as bi-weekly, so we divide by 2 for the weekly display.
  const authorizedWeekly = new Map<ServiceType, number>(
    (compliance?.services ?? []).map((s) => [s.service_type, s.authorized_biweekly / 2]),
  )

  const pillServices = Array.from(new Set([
    ...(compliance?.services ?? []).map((s) => s.service_type),
    ...rows.map((r) => r.service_type),
  ]))
  
  const overplanned = pillServices.filter(
    (st) => (plannedWeekly.get(st) ?? 0) > (authorizedWeekly.get(st) ?? 0) + 1e-9,
  )
  const anyOver = enforceCompliance && overplanned.length > 0

  const totalWeeklyHours = rows.reduce((sum, r) => sum + entryHours(r.start_time, r.end_time), 0)
  
  // Overall authorized bi-weekly hours (sum across all services)
  const totalAuthorizedBiweekly = (compliance?.services ?? []).reduce((sum, s) => sum + s.authorized_biweekly, 0)
  const totalAuthorizedWeekly = totalAuthorizedBiweekly / 2

  async function handleSave() {
    setError(null)
    setSaved(false)
    const payload: WeeklyCarePlanEntryInput[] = rows.map((r) => ({
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
      <div className="flex items-end justify-between px-6 py-5 border-b border-line-soft gap-4">
        <div>
          <Kicker leader className="mb-2">
            {enforceCompliance ? 'Care plan — delivers against the active authorization' : 'Weekly care plan — recurring weekly care'}
          </Kicker>
          <h3 className="font-serif text-[28px] leading-none tracking-[-0.02em]">Weekly schedule</h3>
        </div>
        {enforceCompliance && (
          <div className="flex items-center justify-end">
            <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] uppercase ${anyOver ? 'text-orange' : 'text-mint-dark'}`}>
              <span className="dot" style={{ background: anyOver ? 'var(--color-orange)' : 'var(--color-mint-dark)' }} />
              {anyOver ? 'OVER AUTHORIZATION' : 'WITHIN AUTHORIZATION'}
            </span>
          </div>
        )}
      </div>

      {/* Planned vs Authorized Progress Bars */}
      {enforceCompliance && (
        <div className="bg-cream-2 border-b border-line-soft px-6 py-6 flex flex-col gap-5">
          <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">Planned vs Authorized · Per week</p>
          <div className="flex flex-col gap-4">
            {pillServices.map((st) => {
              const pw = plannedWeekly.get(st) ?? 0
              const aw = authorizedWeekly.get(st) ?? 0
              const isOver = pw > aw + 1e-9
              const percent = aw > 0 ? Math.min((pw / aw) * 100, 100) : (pw > 0 ? 100 : 0)
              
              return (
                <div key={st} className="grid grid-cols-[160px_1fr_120px_100px] items-center gap-4">
                  <div className="text-[13px] text-ink">{SERVICE_TYPE_LABELS[st]}</div>
                  <div className="w-full">
                    <ProgressBar value={percent} max={100} variant={isOver ? 'orange' : 'mint'} className="h-2.5 rounded-none bg-line-soft" />
                  </div>
                  <div className="font-mono text-[11px] text-right">
                    <span className="font-semibold text-ink">{fmtHours(pw)}h</span>
                    <span className="text-ink-soft"> / {fmtHours(aw)}h wk</span>
                  </div>
                  <div className="text-right">
                    <CompliancePill over={isOver} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* table header */}
      <div className="grid grid-cols-[100px_160px_160px_1fr_80px] gap-4 bg-paper px-6 pt-6 pb-2">
        {['Day', 'Start', 'End', 'Service', 'Hrs'].map((h, i) => (
          <div key={i} className={`font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft ${h === 'Hrs' ? 'text-center pr-6' : ''}`}>{h}</div>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="px-6 py-8 font-mono text-[10px] text-muted tracking-wide text-center">
          NO ENTRIES YET — ADD WHEN CARE TIMES ARE KNOWN
        </p>
      )}

      {/* table rows */}
      <div className="flex flex-col">
        {rows.map((r, i) => {
          const hrs = entryHours(r.start_time, r.end_time)
          return (
            <div key={i} className={`grid grid-cols-[100px_160px_160px_1fr_80px] items-center gap-4 px-6 py-3 ${i ? 'border-t border-dashed border-line-soft' : ''}`}>
              <div>
                <select className={selectClass} value={r.day_of_week} onChange={(e) => update(i, { day_of_week: e.target.value as WeekDay })}>
                  {WEEKDAYS.map((d) => <option key={d.key} value={d.key}>{d.label.slice(0, 3)}</option>)}
                </select>
              </div>
              <div><TimeInput value={r.start_time} className={inputClass} onChange={(v) => update(i, { start_time: v })} /></div>
              <div><TimeInput value={r.end_time} className={inputClass} onChange={(v) => update(i, { end_time: v })} /></div>
              <div>
                <select className={selectClass} value={r.service_type} onChange={(e) => update(i, { service_type: e.target.value as ServiceType })}>
                  {SERVICE_TYPES.map((t) => <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between pl-4">
                <span className="font-mono text-[13px] font-semibold">{fmtHours(hrs)}h</span>
                <button type="button" onClick={() => removeRow(i)} className="font-mono text-[16px] text-muted hover:text-orange leading-none pt-0.5">✕</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* footer */}
      <div className="flex items-center justify-between px-6 py-5 border-t border-line-soft bg-paper mt-3">
        <button type="button" onClick={addRow}
          className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-opacity">
          ＋ Add entry
        </button>

        <div className="flex items-center gap-6">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">Weekly total</span>
            <span className="font-serif text-[24px] leading-none tracking-[-0.02em] ml-2">{fmtHours(totalWeeklyHours)}h</span>
            {enforceCompliance && (
              <span className="font-mono text-[11px] text-ink-soft ml-1">
                / {fmtHours(totalAuthorizedWeekly)}h authorized · wk <span className="text-muted">({fmtHours(totalAuthorizedBiweekly)}h bi-weekly)</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 pl-4">
            {saved && <span className="font-mono text-[10px] text-ink-soft">✓ Saved</span>}
            {error && <span className="font-mono text-[10px] text-orange">{error}</span>}
            <button onClick={handleSave} disabled={isPending || anyOver}
              className="rounded-full bg-ink text-cream px-6 py-2.5 font-mono text-[11px] tracking-[0.03em] hover:bg-orange transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              {isPending ? 'Saving…' : 'Save plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
