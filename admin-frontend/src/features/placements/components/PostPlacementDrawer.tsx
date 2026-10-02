import { useState } from 'react'
import { ClientDialog } from '@/features/clients/components/ClientWorkspaceUI'
import { errorMessage } from '@/features/clients/lib/care'
import { toast } from '@/shared/stores/toast'
import { useClient } from '@/features/clients/hooks/useClients'
import { useCareNeedVersions } from '@/features/weekly-care-need/hooks/useWeeklyCareNeed'
import {
  WEEKDAY_LABELS,
  SERVICE_TYPE_LABELS,
} from '@/features/authorizations/constants'
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
  weeklyCareNeedId?: string
  onClose: () => void
  onSuccess?: () => void
}

const labelClass =
  'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass =
  'w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink resize-none'
const selectClass =
  'w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink appearance-none'

// 12-hour label matching the snapshot a worker sees: 9am, 7pm, 9:30am.
const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  const suffix = h < 12 ? 'am' : 'pm'
  const hour12 = h % 12 || 12
  return m
    ? `${hour12}:${String(m).padStart(2, '0')}${suffix}`
    : `${hour12}${suffix}`
}

export function PostPlacementDrawer({
  clients,
  preselectedClientId,
  weeklyCareNeedId,
  onClose,
  onSuccess,
}: PostPlacementDrawerProps) {
  const [clientId, setClientId] = useState(preselectedClientId ?? '')
  const [requirements, setRequirements] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const { mutateAsync: createPlacement, isPending } = useCreatePlacement()

  // The address + care need a worker will see are snapshotted from the client
  // server-side when posting — shown here read-only so the admin can confirm.
  const { data: client } = useClient(clientId)

  const { data: versions = [] } = useCareNeedVersions(clientId)
  const latest = weeklyCareNeedId
    ? versions.find((need) => need.id === weeklyCareNeedId)
    : versions[0]
  const careSlots = latest?.care_slots ?? []
  const stale = !!weeklyCareNeedId && latest?.id !== versions[0]?.id
  const address = client
    ? `${client.street}, ${client.city}, ${client.province} ${client.postal_code}`
    : null

  async function handleSubmit() {
    if (!clientId || !latest || stale) return
    setServerError(null)
    const payload: PlacementCreatePayload = {
      client_id: clientId,
      start_date: latest.effective_from,
      weekly_care_need_id: latest.id,
      ...(requirements ? { requirements } : {}),
    }
    try {
      const created = await createPlacement(payload)
      toast(
        `Placement posted for ${created.client_first_name} ${created.client_last_name}`,
        {
          label: 'View placement',
          to: '/dashboard/placements/$placementId',
          params: { placementId: created.id },
        },
      )
      onSuccess?.()
      onClose()
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  return (
    <ClientDialog
      title="Post as open placement"
      onClose={() => {
        if (!isPending) onClose()
      }}
    >
      <div className="cw-stack">
        {/* Client */}
        <div>
          <label htmlFor="client_id" className={labelClass}>
            Client
          </label>
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
            <p className="border border-ink bg-cream px-3 py-2.5 font-mono text-[12px] text-ink">
              {address}
            </p>
          ) : (
            <p className="border border-dashed border-line-soft px-3 py-2.5 font-mono text-[11px] text-muted">
              Select a client to see their address
            </p>
          )}
        </div>

        {/* Weekly care need — snapshotted, shown to workers */}
        <div>
          <label className={labelClass}>Weekly Care Need</label>
          <p className="font-mono text-[9px] text-ink-soft mb-1.5">
            The recurring care this client needs — shown to workers
          </p>
          {!clientId ? (
            <p className="border border-dashed border-line-soft px-3 py-2.5 font-mono text-[11px] text-muted">
              Select a client to see their weekly care need
            </p>
          ) : careSlots.length === 0 ? (
            <p className="border border-dashed border-line-soft px-3 py-3 font-mono text-[11px] text-muted">
              No weekly care need set for this client yet
            </p>
          ) : (
            <div className="border border-ink bg-cream">
              {careSlots.map((e, i) => (
                <div
                  key={e.id}
                  className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 px-3 py-2 ${i ? 'border-t border-dashed border-line-soft' : ''}`}
                >
                  <span className="font-mono text-[11px] font-semibold text-ink">
                    {WEEKDAY_LABELS[e.day_of_week]}
                  </span>
                  <span className="font-mono text-[11px] text-ink-soft">
                    {fmtTime(e.start_time)}–{fmtTime(e.end_time)}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft">
                    {SERVICE_TYPE_LABELS[e.service_type]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Care starts */}
        <div>
          <label className={labelClass}>Care starts</label>
          <p className="font-mono text-[9px] text-ink-soft mb-1.5">
            Proposed start shown to workers. Shifts are created only after
            approval.
          </p>
          <p className="text-sm">
            {latest?.effective_from ?? 'Save a Weekly Care Need first'}
          </p>
        </div>

        {/* Requirements */}
        <div>
          <label htmlFor="requirements" className={labelClass}>
            Requirements <span className="opacity-40">(optional)</span>
          </label>
          <textarea
            id="requirements"
            rows={3}
            placeholder="e.g. Must have First Aid, driver's licence preferred"
            className={inputClass}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
          />
        </div>

        {latest?.imported && (
          <p className="text-sm text-ink-soft">
            Save a new Weekly Care Need revision on the client profile before
            posting replacement coverage.
          </p>
        )}
        {stale && (
          <p role="alert">
            A newer revision is available. Close this panel and review it before
            posting.
          </p>
        )}
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
          disabled={
            isPending ||
            stale ||
            !clientId ||
            !latest ||
            latest.imported ||
            careSlots.length === 0
          }
          className="cw-btn cw-btn-primary"
        >
          {isPending ? 'Posting…' : 'Post as open placement'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="cw-btn"
        >
          Cancel
        </button>
      </div>
    </ClientDialog>
  )
}
