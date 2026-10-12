import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { ClientDialog } from '@/features/clients/components/ClientWorkspaceUI'
import { errorMessage, weeklyHours } from '@/features/clients/lib/care'
import { toast } from '@/shared/stores/toast'
import { useClient } from '@/features/clients/hooks/useClients'
import { useCareNeedVersions } from '@/features/weekly-care-need/hooks/useWeeklyCareNeed'
import {
  WEEKDAY_LABELS,
  SERVICE_TYPE_LABELS,
} from '@/features/authorizations/constants'
import { useCreatePlacement } from '../hooks/usePlacements'
import { requestDate, sortCareSlots } from '../lib/careRequests'
import '../care-requests.css'

interface PostPlacementDrawerProps {
  clients: { id: string; first_name: string; last_name: string }[]
  preselectedClientId?: string
  weeklyCareNeedId?: string
  onClose: () => void
  onSuccess?: () => void
}

// Layer 3: posts the selected saved revision; previewing never creates visits.
export function PostPlacementDrawer({
  clients,
  preselectedClientId,
  weeklyCareNeedId,
  onClose,
  onSuccess,
}: PostPlacementDrawerProps) {
  const [clientId, setClientId] = useState(preselectedClientId ?? '')
  const [requirements, setRequirements] = useState('')
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState(false)
  const [previewRevision, setPreviewRevision] = useState('')
  const [serverError, setServerError] = useState('')
  const create = useCreatePlacement()
  const client = useClient(clientId)
  const versions = useCareNeedVersions(clientId)
  const newest = [...(versions.data ?? [])].sort(
    (a, b) => b.version - a.version,
  )[0]
  const latest = weeklyCareNeedId
    ? versions.data?.find((n) => n.id === weeklyCareNeedId)
    : newest
  const slots = sortCareSlots(latest?.care_slots ?? [])
  const stale = !!weeklyCareNeedId && latest?.id !== newest?.id
  const loading = !!clientId && (client.isPending || versions.isPending)
  const failed = client.isError || versions.isError
  const valid =
    !!clientId &&
    !!client.data &&
    !!latest &&
    !latest.imported &&
    slots.length > 0 &&
    !stale &&
    !loading &&
    !failed
  const address = client.data
    ? `${client.data.street}, ${client.data.city}, ${client.data.province} ${client.data.postal_code}`
    : ''
  // Both text fields use the existing worker-visible requirements contract.
  const workerNotes = [
    requirements.trim(),
    notes.trim() ? `Additional notes:\n${notes.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const selectedClient = clients.find((c) => c.id === clientId)
  async function post() {
    if (!valid || !latest || latest.id !== previewRevision) return
    setServerError('')
    try {
      const created = await create.mutateAsync({
        client_id: clientId,
        weekly_care_need_id: latest.id,
        start_date: latest.effective_from,
        ...(workerNotes ? { requirements: workerNotes } : {}),
      })
      toast(
        `Care request posted for ${created.client_first_name} ${created.client_last_name}`,
        {
          label: 'View care request',
          to: '/dashboard/placements/$placementId',
          params: { placementId: created.id },
        },
      )
      onSuccess?.()
      onClose()
    } catch (err) {
      setServerError(errorMessage(err))
    }
  }
  return (
    <ClientDialog
      title={preview ? 'Review care request' : 'Post care request'}
      onClose={() => {
        if (!create.isPending) onClose()
      }}
    >
      <div className="care-requests cr-stack">
        {preview ? (
          <>
            <button
              className="cr-link justify-self-start"
              disabled={create.isPending}
              onClick={() => setPreview(false)}
            >
              <ArrowLeft size={16} /> Back to request
            </button>
            <p className="cr-small">
              Worker posting preview · {selectedClient?.first_name}{' '}
              {selectedClient?.last_name}
            </p>
            <section className="cr-posting">
              <p className="cr-label">Care request / Client available</p>
              <h2>HSW needed.</h2>
              <p>{address}</p>
              <div className="mt-6">
                <p className="cr-label">Days & times</p>
                {slots.map((s) => (
                  <div className="cr-review-row" key={s.id}>
                    <span>
                      {WEEKDAY_LABELS[s.day_of_week]} ·{' '}
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </span>
                    <span>{SERVICE_TYPE_LABELS[s.service_type]}</span>
                  </div>
                ))}
              </div>
              <p className="cr-muted mt-4">{weeklyHours(slots)} hours / week</p>
              <div className="mt-6">
                <p className="cr-label">Care request start date</p>
                <p className="mt-2">{requestDate(latest?.effective_from)}</p>
              </div>
              {workerNotes && (
                <div className="mt-6">
                  <p className="cr-label">Care & notes</p>
                  <p className="whitespace-pre-wrap mt-2">{workerNotes}</p>
                </div>
              )}
            </section>
            {latest?.id !== previewRevision && (
              <p role="alert" className="cr-error">
                The saved revision changed. Go back and review it before
                posting.
              </p>
            )}
          </>
        ) : (
          <>
            <label className="cr-field">
              Client
              {preselectedClientId ? (
                <span className="font-serif text-2xl">
                  {selectedClient?.first_name} {selectedClient?.last_name}
                </span>
              ) : (
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value)
                    setServerError('')
                    setRequirements('')
                    setNotes('')
                  }}
                >
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            {clientId &&
              (loading ? (
                <p role="status">Loading saved care need…</p>
              ) : failed ? (
                <p role="alert">
                  Could not load the client’s care need.{' '}
                  <button
                    className="cr-link"
                    onClick={() => {
                      void client.refetch()
                      void versions.refetch()
                    }}
                  >
                    Retry
                  </button>
                </p>
              ) : latest && slots.length ? (
                <section className="cr-posting">
                  <div className="cr-between">
                    <h3>Weekly care need</h3>
                    <span className="cr-badge">Revision {latest.version}</span>
                  </div>
                  <p className="cr-muted mt-3">{address}</p>
                  {slots.map((s) => (
                    <div className="cr-review-row" key={s.id}>
                      <span>
                        {WEEKDAY_LABELS[s.day_of_week]} ·{' '}
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      </span>
                      <span>{SERVICE_TYPE_LABELS[s.service_type]}</span>
                    </div>
                  ))}
                  <div className="cr-between mt-5">
                    <span>Starts {requestDate(latest.effective_from)}</span>
                    <span>{weeklyHours(slots)}h / week</span>
                  </div>
                </section>
              ) : (
                <p>
                  Save a Weekly Care Need before posting.{' '}
                  <Link
                    className="cr-link"
                    to="/dashboard/clients/$clientId/care-need"
                    params={{ clientId }}
                  >
                    Open weekly care need
                  </Link>
                </p>
              ))}
            <label className="cr-field">
              Care & requirements{' '}
              <span className="cr-small">Optional · visible to workers</span>
              <textarea
                rows={3}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Care tasks or experience needed"
              />
            </label>
            <label className="cr-field">
              Additional notes{' '}
              <span className="cr-small">Optional · visible to workers</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. One cat in the home"
              />
            </label>
            {latest?.imported && (
              <p>
                Save a new Weekly Care Need revision before posting replacement
                coverage.
              </p>
            )}
            {stale && (
              <p role="alert">
                A newer revision is available. Close this panel and review it
                before posting.
              </p>
            )}
          </>
        )}
        <p className="cr-small">
          Posting invites worker interest. Visits are created only after
          approval.
        </p>
        {serverError && (
          <p role="alert" className="cr-error">
            {serverError}
          </p>
        )}
        <div className="cr-between">
          <button
            className="cr-button"
            disabled={create.isPending}
            onClick={onClose}
          >
            Cancel
          </button>
          {preview ? (
            <button
              className="cr-button cr-primary"
              disabled={
                !valid || create.isPending || latest?.id !== previewRevision
              }
              onClick={() => void post()}
            >
              {create.isPending ? 'Posting…' : 'Post care request'}{' '}
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="cr-button cr-primary"
              disabled={!valid}
              onClick={() => {
                setPreviewRevision(latest!.id)
                setPreview(true)
              }}
            >
              Review posting <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </ClientDialog>
  )
}
