import { Activity } from 'lucide-react'
import { useAuthStore } from '@/shared/stores/auth'
import { useOperatorWebhooks } from '../hooks/useBillingOperator'
import { OperatorBadge, OperatorClearState, OperatorRefresh } from './OperatorStatus'

export function OperatorWebhookAlerts() {
  const userId = useAuthStore(s => s.user?.id)
  const query = useOperatorWebhooks(userId)
  return <section aria-labelledby="stripe-message-heading" className="min-w-0 rounded-2xl border border-ink/15 bg-paper p-5 sm:p-6">
    <div className="mb-4 flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft"><Activity size={15} aria-hidden="true" />Payment activity</span><OperatorRefresh label="Refresh message status" busy={query.isFetching} onClick={() => void query.refetch()} /></div>
    <div className="mb-4 flex flex-wrap items-center gap-2"><h2 id="stripe-message-heading" className="font-serif text-2xl">Stripe messages</h2>{query.isSuccess && query.data.events.length > 0 && <OperatorBadge tone="attention">{query.data.events.length}{query.data.has_more ? '+' : ''} awaiting completion</OperatorBadge>}</div>
    {query.isPending && <p role="status" className="py-3 text-sm text-ink-soft">Loading message status…</p>}
    {query.isError && <p role="alert" className="rounded-lg bg-orange-soft p-3 text-sm">Could not load Stripe message status. Refresh to retry.</p>}
    {query.isSuccess && query.data.events.length === 0 && <OperatorClearState title="No pending or failed messages.">There are no Stripe messages awaiting completion.</OperatorClearState>}
    {query.isSuccess && query.data.events.length > 0 && <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
      {query.data.events.map(event => <article className="space-y-2 rounded-lg border border-ink/10 p-3 text-xs leading-5" key={event.event_id}>
        <div className="flex flex-wrap items-center justify-between gap-2"><OperatorBadge tone={event.state === 'failed' ? 'attention' : 'neutral'}>{event.state.replaceAll('_', ' ')}</OperatorBadge><span className="text-ink-soft">{event.attempts} attempts</span></div>
        <p className="break-all font-medium">{event.event_type}</p>
        <p className="break-all font-mono text-[10px] text-ink-soft">{event.event_id}</p>
        {event.error_code && <p className="break-words text-[#923511]">{event.error_code}</p>}
        <p className="text-ink-soft">Received {new Date(event.received_at).toLocaleString()}<br />Eligible for retry after {new Date(event.lease_until ?? event.next_attempt_at).toLocaleString()}</p>
      </article>)}
    </div>}
    {query.isSuccess && query.data.has_more && <p className="mt-3 text-xs text-ink-soft">Showing the oldest 100 pending messages. More remain in the receipt log.</p>}
    <p className="mt-4 text-xs leading-5 text-ink-soft">Failed messages retry automatically. Repeated failures need investigation using the event reference.</p>
  </section>
}
