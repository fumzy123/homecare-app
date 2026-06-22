import { useState } from 'react'
import { Kicker } from '@/shared/components/ui'
import { useClient } from '@/features/clients/hooks/useClients'
import { useWeeklyCarePlan } from '@/features/weekly-care-plan/hooks/useWeeklyCarePlan'
import { WEEKDAY_LABELS, SERVICE_TYPE_LABELS } from '@/features/authorizations/constants'
import { useCreatePlacement } from '../hooks/usePlacements'
import type { PlacementCreatePayload } from '../api'

interface Client {
  id: string
  first_name: string
  last_name: string
}

interface PostPlacementDrawerProps {
  clients: Client[]
  preselectedClientId?: string
  onClose: () => void
  onSuccess?: () => void
}

const labelClass  = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass  = 'w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink resize-none'
const selectClass = 'w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink appearance-none'

const hhmm = (t: string) => t.slice(0, 5)

export function PostPlacementDrawer({
  clients,
  preselectedClientId,
  onClose,
  onSuccess,
}: PostPlacementDrawerProps) {
  const [clientId, setClientId]       = useState(preselectedClientId ?? '')
  const [requirements, setRequirements] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const { mutateAsync: createPlacement, isPending } = useCreatePlacement()

  // The address + care plan a worker will see are snapshotted from the client
  // server-side when posting — shown here read-only so the admin can confirm.
  const { data: client }            = useClient(clientId)
  const { data: planEntries = [] }  = useWeeklyCarePlan(clientId)

  const address = client
    ? `${client.street}, ${client.city}, ${client.province} ${client.postal_code}`
    : null

  async function handleSubmit() {
    if (!clientId) return
    setServerError(null)
    const payload: PlacementCreatePayload = {
      client_id: clientId,
      ...(requirements ? { requirements } : {}),
    }
    try {
      await createPlacement(payload)
      onSuccess?.()
      onClose()
    } catch {
      setServerError('Failed to post placement. Please try again.')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col bg-paper border-l border-ink">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <Kicker>Post Placement</Kicker>
          <button onClick={onClose} className="font-mono text-[18px] text-ink-soft hover:text-ink leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
          {/* Client */}
          <div>
            <label htmlFor="client_id" className={labelClass}>Client</label>
            {preselectedClientId ? (
              <p className="font-mono text-[13px] text-ink font-medium">
                {clients.find((c) => c.id === preselectedClientId)?.first_name}{' '}
                {clients.find((c) => c.id === preselectedClientId)?.last_name}
              </p>
            ) : (
              <select
                id="client_id"
                className={selectClass}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Address — snapshotted, shown to workers */}
          <div>
            <label className={labelClass}>Address</label>
            <p className="font-mono text-[9px] text-ink-soft mb-1.5">
              The client's full address — shared with workers on this placement
            </p>
            {address ? (
              <p className="border border-ink bg-cream px-3 py-2.5 font-mono text-[12px] text-ink">{address}</p>
            ) : (
              <p className="border border-dashed border-line-soft px-3 py-2.5 font-mono text-[11px] text-muted">
                Select a client to see their address
              </p>
            )}
          </div>

          {/* Weekly care plan — snapshotted, shown to workers */}
          <div>
            <label className={labelClass}>Weekly Care Plan</label>
            <p className="font-mono text-[9px] text-ink-soft mb-1.5">
              The recurring care this client needs — shown to workers
            </p>
            {!clientId ? (
              <p className="border border-dashed border-line-soft px-3 py-2.5 font-mono text-[11px] text-muted">
                Select a client to see their weekly care plan
              </p>
            ) : planEntries.length === 0 ? (
              <p className="border border-dashed border-line-soft px-3 py-3 font-mono text-[11px] text-muted">
                No weekly care plan set for this client yet
              </p>
            ) : (
              <div className="border border-ink bg-cream">
                {planEntries.map((e, i) => (
                  <div
                    key={e.id}
                    className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 px-3 py-2 ${i ? 'border-t border-dashed border-line-soft' : ''}`}
                  >
                    <span className="font-mono text-[11px] font-semibold text-ink">{WEEKDAY_LABELS[e.day_of_week]}</span>
                    <span className="font-mono text-[11px] text-ink-soft">{hhmm(e.start_time)}–{hhmm(e.end_time)}</span>
                    <span className="font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft">{SERVICE_TYPE_LABELS[e.service_type]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Requirements */}
          <div>
            <label htmlFor="requirements" className={labelClass}>Requirements <span className="opacity-40">(optional)</span></label>
            <textarea
              id="requirements"
              rows={3}
              placeholder="e.g. Must have First Aid, driver's licence preferred"
              className={inputClass}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
            />
          </div>

          {serverError && (
            <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">
              {serverError}
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-3 px-6 py-4 border-t border-ink">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !clientId}
            className="flex-1 bg-ink text-cream px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] hover:bg-orange hover:border-orange transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? 'Posting…' : 'Post Placement'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] border border-ink text-ink-soft hover:text-ink hover:bg-cream-2 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
