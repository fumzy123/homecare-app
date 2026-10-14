import { useState } from 'react'
import { useAuthStore } from '@/shared/stores/auth'
import { useBillingReviewQueue } from '../hooks/useBillingReviews'

// Layer 3: operator-only queue. Financial adjustments use the existing period controls.
export function OperatorBillingReviews({ onSelect }: { onSelect: (org: string) => void }) {
  const userId = useAuthStore(state => state.user?.id)
  const { queue, resolve } = useBillingReviewQueue(userId)
  const [selected, setSelected] = useState<string | null>(null)
  const [response, setResponse] = useState('')
  return <section className="border border-ink p-4 space-y-3">
    <h2 className="font-semibold">Agency billing questions</h2>
    <button className="underline" disabled={queue.isFetching} onClick={() => void queue.refetch()}>Refresh questions</button>
    {queue.isPending && <p>Loading questions…</p>}
    {queue.isError && <p role="alert">Could not load billing questions. Refresh to retry.</p>}
    {queue.isSuccess && queue.data.requests.length === 0 && <p>No open billing questions.</p>}
    {queue.isSuccess && queue.data.requests.map(row => <article key={row.id} className="border-t border-line-soft pt-3 space-y-2">
      <p><strong>{row.agency_name}</strong> · {new Date(row.submitted_at).toLocaleString()}</p>
      <p className="text-sm break-all">Period reference: {row.period_id}</p>
      <p className="whitespace-pre-wrap break-words">{row.message}</p>
      <button className="underline mr-4" onClick={() => onSelect(row.org_id)}>Open agency billing</button>
      <button className="underline" disabled={resolve.isPending} onClick={() => { setSelected(row.id); setResponse(''); resolve.reset() }}>Record review response</button>
      {selected === row.id && <form className="space-y-2" onSubmit={event => {
        event.preventDefault(); resolve.mutate({ id: row.id, response: response.trim() }, { onSuccess: () => { setSelected(null); setResponse('') } })
      }}>
        <p className="text-sm">Record the investigation and outcome. If money needs correcting, use the period adjustment controls first. Resolving this request does not issue a credit or change an invoice.</p>
        <label className="block">Response visible to the agency<textarea className="block border border-ink p-2 w-full" rows={3} value={response} minLength={10} maxLength={1000} required disabled={resolve.isPending} onChange={event => setResponse(event.target.value)} /></label>
        <button className="border border-ink px-4 py-2 disabled:opacity-40" disabled={resolve.isPending || response.trim().length < 10}>Save response and resolve</button>
        {resolve.isError && <p role="alert">{resolve.error.message}</p>}
      </form>}
    </article>)}
    {queue.data?.has_more && <p>The oldest 100 requests are shown. Resolve reviewed requests to reveal the remainder.</p>}
  </section>
}
