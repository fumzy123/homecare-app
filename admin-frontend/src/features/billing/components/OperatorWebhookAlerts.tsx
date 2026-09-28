import { useAuthStore } from '@/shared/stores/auth'
import { useOperatorWebhooks } from '../hooks/useBillingOperator'

export function OperatorWebhookAlerts() {
  const userId = useAuthStore(s => s.user?.id)
  const query = useOperatorWebhooks(userId)
  return <section className="border border-ink bg-paper p-4 space-y-3">
    <h2 className="font-serif text-xl">Stripe messages awaiting completion</h2>
    <p className="text-sm">Failed messages retry automatically. Repeated failures need investigation using the event reference below.</p>
    <button className="underline disabled:opacity-40" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh message status</button>
    {query.isPending && <p>Loading message status…</p>}
    {query.isError && <p role="alert">Could not load Stripe message status. Refresh to retry.</p>}
    {!query.isError && query.data?.events.length === 0 && <p>No pending or failed messages.</p>}
    {!query.isError && query.data?.events.map(event => <div className="border-t border-line-faint pt-3 text-sm" key={event.event_id}>
      <p className="break-all">{event.event_type} · {event.event_id}</p>
      <p>{event.state} · {event.attempts} attempts{event.error_code && ` · ${event.error_code}`}</p>
      <p>Received {new Date(event.received_at).toLocaleString()} · Eligible for retry after {new Date(event.lease_until ?? event.next_attempt_at).toLocaleString()}</p>
    </div>)}
    {query.data?.has_more && <p>Showing the oldest 100 pending messages. More remain in the receipt log.</p>}
  </section>
}
