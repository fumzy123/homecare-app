import { useState } from 'react'
import { Kicker, DateInput } from '@/shared/components/ui'
import { useCreateAuthorization } from '../hooks/useAuthorizations'
import { SERVICE_TYPES, SERVICE_TYPE_LABELS, HOURS_PERIOD_LABELS } from '../constants'
import type {
  Authorization,
  AuthorizationCreatePayload,
  AuthorizationServiceInput,
  HoursPeriod,
  ServiceType,
} from '../api'

const labelClass  = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass  = 'w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink resize-none'
const selectClass = inputClass + ' appearance-none'

interface Props {
  clientId: string
  amends?: Authorization
  onClose: () => void
}

interface ServiceRow {
  service_type: ServiceType
  hours: string
}

export function AuthorizationDrawer({ clientId, amends, onClose }: Props) {
  const { mutateAsync: create, isPending } = useCreateAuthorization(clientId)
  const [serverError, setServerError] = useState<string | null>(null)

  const [funder, setFunder]                 = useState(amends?.funder ?? '')
  const [fileNumber, setFileNumber]         = useState(amends?.funder_file_number ?? '')
  const [authNumber, setAuthNumber]         = useState(amends ? '' : '')
  const [coveringStart, setCoveringStart]   = useState(amends?.covering_start ?? '')
  const [coveringEnd, setCoveringEnd]       = useState(amends?.covering_end ?? '')
  const [dateIssued, setDateIssued]         = useState(amends?.date_issued ?? '')
  const [authorizedBy, setAuthorizedBy]     = useState(amends?.authorized_by ?? '')
  const [hoursPeriod, setHoursPeriod]       = useState<HoursPeriod>(amends?.hours_period ?? 'bi_weekly')
  const [contribution, setContribution]     = useState(
    amends?.client_monthly_contribution_amount != null ? String(amends.client_monthly_contribution_amount) : '',
  )
  const [invoiceTo, setInvoiceTo]           = useState(amends?.invoice_to ?? '')
  const [notes, setNotes]                   = useState('')
  const [services, setServices]             = useState<ServiceRow[]>(
    amends?.services.map((s) => ({ service_type: s.service_type, hours: String(s.authorized_hours) }))
      ?? [{ service_type: 'personal_care', hours: '' }],
  )

  function updateService(i: number, patch: Partial<ServiceRow>) {
    setServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  function addService() {
    setServices((prev) => [...prev, { service_type: 'homemaking', hours: '' }])
  }
  function removeService(i: number) {
    setServices((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    if (!funder.trim() || !authNumber.trim() || !coveringStart) {
      setServerError('Funder, authorization number, and covering start are required.')
      return
    }
    const parsedServices: AuthorizationServiceInput[] = []
    for (const s of services) {
      const hours = parseFloat(s.hours)
      if (!Number.isFinite(hours) || hours <= 0) {
        setServerError('Every service needs a positive number of hours.')
        return
      }
      parsedServices.push({ service_type: s.service_type, authorized_hours: hours })
    }
    if (parsedServices.length === 0) {
      setServerError('Add at least one service.')
      return
    }
    if (new Set(parsedServices.map((s) => s.service_type)).size !== parsedServices.length) {
      setServerError('Each service can only appear once.')
      return
    }

    const payload: AuthorizationCreatePayload = {
      funder: funder.trim(),
      funder_file_number: fileNumber.trim() || null,
      authorization_number: authNumber.trim(),
      covering_start: coveringStart,
      covering_end: coveringEnd || null,
      date_issued: dateIssued || null,
      authorized_by: authorizedBy.trim() || null,
      hours_period: hoursPeriod,
      client_monthly_contribution_amount: contribution ? parseFloat(contribution) : null,
      invoice_to: invoiceTo.trim() || null,
      notes: notes.trim() || null,
      supersedes_id: amends?.id ?? null,
      services: parsedServices,
    }

    try {
      await create(payload)
      onClose()
    } catch {
      setServerError('Failed to save authorization. Please try again.')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col bg-paper border-l border-ink">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <Kicker>{amends ? 'Amend Authorization' : 'New Authorization'}</Kicker>
          <button onClick={onClose} className="font-mono text-[18px] text-ink-soft hover:text-ink leading-none">×</button>
        </div>

        {amends && (
          <p className="px-6 py-2 bg-cream-2 border-b border-line-soft font-mono text-[10px] text-ink-soft">
            Supersedes {amends.authorization_number} — the previous authorization stays on record.
          </p>
        )}

        <form className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5" onSubmit={handleSubmit}>
          <div>
            <label className={labelClass}>Funder</label>
            <input className={inputClass} value={funder} onChange={(e) => setFunder(e.target.value)}
              placeholder="e.g. NL Health Services / Eastern Health" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Authorization #</label>
              <input className={inputClass} value={authNumber} onChange={(e) => setAuthNumber(e.target.value)}
                placeholder="R-ES-1372537" />
            </div>
            <div>
              <label className={labelClass}>Funder File #</label>
              <input className={inputClass} value={fileNumber} onChange={(e) => setFileNumber(e.target.value)}
                placeholder="431576" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Covering Start</label>
              <DateInput value={coveringStart} onChange={setCoveringStart} />
            </div>
            <div>
              <label className={labelClass}>Covering End <span className="opacity-40">(optional)</span></label>
              <DateInput value={coveringEnd} onChange={setCoveringEnd} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Date Issued <span className="opacity-40">(optional)</span></label>
              <DateInput value={dateIssued} onChange={setDateIssued} />
            </div>
            <div>
              <label className={labelClass}>Hours Period</label>
              <select className={selectClass} value={hoursPeriod} onChange={(e) => setHoursPeriod(e.target.value as HoursPeriod)}>
                {(Object.keys(HOURS_PERIOD_LABELS) as HoursPeriod[]).map((p) => (
                  <option key={p} value={p}>{HOURS_PERIOD_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Services */}
          <div>
            <label className={labelClass}>Authorized Services</label>
            <div className="flex flex-col gap-2">
              {services.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className={selectClass + ' flex-1'}
                    value={s.service_type}
                    onChange={(e) => updateService(i, { service_type: e.target.value as ServiceType })}
                  >
                    {SERVICE_TYPES.map((t) => (
                      <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  <input
                    className={inputClass + ' w-20'}
                    type="number" min="0" step="0.5" placeholder="hrs"
                    value={s.hours}
                    onChange={(e) => updateService(i, { hours: e.target.value })}
                  />
                  {services.length > 1 && (
                    <button type="button" onClick={() => removeService(i)}
                      className="font-mono text-[16px] text-ink-soft hover:text-orange leading-none px-1">×</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addService}
              className="mt-2 font-mono text-[10px] uppercase tracking-[0.05em] text-ink-soft hover:text-ink">
              ＋ Add service
            </button>
            <p className="mt-1 font-mono text-[9px] text-ink-soft">Hours are per the selected period.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Authorized By <span className="opacity-40">(optional)</span></label>
              <input className={inputClass} value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)}
                placeholder="Lois Hussey" />
            </div>
            <div>
              <label className={labelClass}>Contribution $/mo <span className="opacity-40">(optional)</span></label>
              <input className={inputClass} type="number" min="0" step="0.01" value={contribution}
                onChange={(e) => setContribution(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Invoice To <span className="opacity-40">(optional)</span></label>
            <textarea className={inputClass} rows={2} value={invoiceTo} onChange={(e) => setInvoiceTo(e.target.value)}
              placeholder="Eastern Health — Client Services Division, Mt. Pearl" />
          </div>

          <div>
            <label className={labelClass}>Notes <span className="opacity-40">(optional)</span></label>
            <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {serverError && (
            <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
          )}

          <div className="flex gap-3 pt-2 border-t border-ink mt-2">
            <button type="submit" disabled={isPending}
              className="flex-1 bg-ink text-cream px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] hover:bg-orange transition-colors disabled:opacity-40">
              {isPending ? 'Saving…' : amends ? 'Save Amendment' : 'Add Authorization'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] border border-ink text-ink-soft hover:text-ink hover:bg-cream-2 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
