import { WEEKDAY_LABELS, SERVICE_TYPE_LABELS } from '@/features/authorizations/constants'
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useCareNeedVersions } from '../hooks/useWeeklyCareNeed'
import { useClient } from '@/features/clients/hooks/useClients'
import { usePlacements } from '@/features/placements/hooks/usePlacements'
import { PostPlacementDrawer } from '@/features/placements/components/PostPlacementDrawer'

export function CareNeedHistory({ clientId, attentionNeedId }: { clientId: string; attentionNeedId?: string }) {
  const versions = useCareNeedVersions(clientId)
  const { data: client } = useClient(clientId)
  const { data: placements = [] } = usePlacements()
  const [posting, setPosting] = useState(false)
  useEffect(() => { if (attentionNeedId) document.getElementById(`care-need-${attentionNeedId}`)?.scrollIntoView({ block: 'center' }) }, [attentionNeedId, versions.isPending])
  if (versions.isPending) return <p role="status">Loading Weekly Care Need…</p>
  if (versions.isError) return <p role="alert">Could not load care history. <button onClick={() => void versions.refetch()}>Retry</button></p>
  return <section className="border border-ink bg-paper p-6 space-y-4">
    <h2 className="font-serif text-2xl">Weekly Care Need history</h2>
    {attentionNeedId && !versions.data.some(n => n.id === attentionNeedId) && <p role="status">This Weekly Care Need is no longer available. Review the current versions below.</p>}
    {!versions.data.length && <p>No Weekly Care Need has been saved yet.</p>}
    {versions.data.map((need, index) => {
      const placement = placements.find(p => p.weekly_care_need_id === need.id)
      return <details id={`care-need-${need.id}`} key={need.id} open={attentionNeedId ? need.id === attentionNeedId : index === 0} className={`border-t border-line-soft pt-3 ${need.id === attentionNeedId ? 'border-l-2 border-l-orange pl-4' : ''}`}>
        <summary className="cursor-pointer font-mono text-xs">Version {need.version} · Effective {need.effective_from} · {need.ends_on ? `Ended ${need.ends_on}` : need.imported ? 'Imported schedule' : need.activated_at ? 'Coverage approved' : index > 0 ? 'Superseded proposal' : 'Awaiting coverage approval'}</summary>
        {need.imported && <p className="mt-2 text-sm text-ink-soft">Existing care and shift history were preserved. Save a new version below to post Care Slots and review replacement coverage.</p>}
        <p className="mt-2 text-xs text-ink-soft">Recorded {new Date(need.created_at).toLocaleString()}{need.scheduled_from ? ` · Scheduled from ${need.scheduled_from}` : ''}</p>
        <ul className="my-3 space-y-2">{need.care_slots.map(slot => <li key={slot.id} className="text-sm">{WEEKDAY_LABELS[slot.day_of_week]} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {SERVICE_TYPE_LABELS[slot.service_type]}</li>)}</ul>
        {placement ? <Link to="/dashboard/placements/$placementId" params={{ placementId: placement.id }} className="underline text-sm">Review placement · {placement.covered_count}/{placement.care_slots.length} Care Slots covered</Link>
          : index === 0 && !need.imported && <button className="rounded-full bg-ink text-cream px-5 py-2 text-sm" onClick={() => setPosting(true)}>Post as open placement</button>}
        {index === 0 && placement?.status === 'closed' && !need.ends_on && <button className="block mt-3 rounded-full bg-ink text-cream px-5 py-2 text-sm" onClick={() => setPosting(true)}>Reopen placement</button>}
      </details>
    })}
    {client && <div className="border-t border-line-soft pt-4"><h3 className="font-serif text-xl">Care team</h3>
      {client.care_team?.length ? client.care_team.map(worker => <p key={worker.id} className="mt-2 text-sm">{worker.first_name} {worker.last_name} — {worker.coverage.join('; ')}</p>) : <p className="mt-2 text-sm text-ink-soft">No upcoming worker coverage.</p>}
    </div>}
    {posting && client && <PostPlacementDrawer clients={[client]} preselectedClientId={clientId} onClose={() => setPosting(false)} />}
  </section>
}
