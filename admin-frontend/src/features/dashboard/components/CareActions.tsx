import { Link } from '@tanstack/react-router'
import { useCareActions } from '../hooks/useCareActions'
export function CareActions() {
  const query = useCareActions()
  return <section className="border-t border-line-soft px-6 py-5">
    <h3 className="font-medium text-sm">Care coverage</h3>
    {query.isPending ? <p role="status" className="mt-2 text-xs">Checking Care Slots…</p> : query.isError ? <p role="alert" className="mt-2 text-xs">Could not check care coverage. <button className="underline" onClick={() => void query.refetch()}>Retry</button></p>
      : query.data.length === 0 ? <p className="mt-2 text-xs text-ink-soft">No outstanding care placement actions.</p>
        : <ul className="mt-3 space-y-4">{query.data.map(item => <li key={item.weekly_care_need_id} className="text-xs">
          <p className="font-medium">{item.client_name}</p>{item.overdue && <p className="mt-1 text-orange">Start date reached · Schedule change not yet approved</p>}<p className="text-ink-soft mt-1">{item.uncovered_count} Care Slots uncovered · Starts {item.effective_from}{item.pending_interest_count > 0 ? ` · ${item.pending_interest_count} interested workers` : ''}</p>
          {item.placement_id && item.action !== 'Post placement' ? <Link className="mt-2 inline-block underline" to="/dashboard/placements/$placementId" params={{ placementId: item.placement_id }}>{item.action}</Link>
            : <Link className="mt-2 inline-block underline" to="/dashboard/clients/$clientId/care-need" params={{ clientId: item.client_id }}>{item.action}</Link>}
        </li>)}</ul>}
  </section>
}
