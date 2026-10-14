import { useState } from 'react'
import { ArrowUpRight, MessageSquare } from 'lucide-react'
import { useAuthStore } from '@/shared/stores/auth'
import { useBillingReviewQueue } from '../hooks/useBillingReviews'
import { OperatorBadge, OperatorClearState, OperatorRefresh } from './OperatorStatus'
import { operatorButton, operatorInput, operatorPrimaryButton } from './operator-styles'

// Layer 3: operator-only queue. Financial adjustments use the existing period controls.
export function OperatorBillingReviews({ onSelect }: { onSelect: (org: string) => void }) {
  const userId = useAuthStore(state => state.user?.id)
  const { queue, resolve } = useBillingReviewQueue(userId)
  const [selected, setSelected] = useState<string | null>(null)
  const [response, setResponse] = useState('')
  return <section aria-labelledby="billing-question-heading" className="min-w-0 rounded-2xl border border-ink/15 bg-paper p-5 sm:p-6">
    <div className="mb-4 flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft"><MessageSquare size={15} aria-hidden="true" />Agency support</span><OperatorRefresh label="Refresh questions" busy={queue.isFetching} onClick={() => void queue.refetch()} /></div>
    <div className="mb-4 flex flex-wrap items-center gap-2"><h2 id="billing-question-heading" className="font-serif text-2xl">Agency billing questions</h2>{queue.isSuccess && queue.data.requests.length > 0 && <OperatorBadge tone="attention">{queue.data.requests.length}{queue.data.has_more ? '+' : ''} open</OperatorBadge>}</div>
    {queue.isPending && <p role="status" className="py-3 text-sm text-ink-soft">Loading questions…</p>}
    {queue.isError && <p role="alert" className="rounded-lg bg-orange-soft p-3 text-sm">Could not load billing questions. Refresh to retry.</p>}
    {queue.isSuccess && queue.data.requests.length === 0 && <OperatorClearState title="No open billing questions.">New questions from agencies will appear here for review.</OperatorClearState>}
    {queue.isSuccess && queue.data.requests.length > 0 && <div className="max-h-[560px] space-y-4 overflow-y-auto pr-1">{queue.data.requests.map(row => <article key={row.id} className="space-y-3 rounded-xl border border-ink/15 p-4 text-sm">
      <div><h3 className="break-words font-semibold">{row.agency_name}</h3><p className="mt-1 text-xs text-ink-soft">{new Date(row.submitted_at).toLocaleString()}</p></div>
      <p className="break-all font-mono text-[10px] text-ink-soft">Period reference: {row.period_id}</p>
      <p className="whitespace-pre-wrap break-words leading-6">{row.message}</p>
      <div className="flex flex-wrap gap-2"><button className={`${operatorButton} !text-xs`} onClick={() => onSelect(row.org_id)}>Open agency billing<ArrowUpRight size={14} aria-hidden="true" /></button>
        <button className={`${operatorButton} !text-xs`} disabled={resolve.isPending} onClick={() => { setSelected(row.id); setResponse(''); resolve.reset() }}>Record review response</button></div>
      {selected === row.id && <form className="space-y-3 border-t border-ink/10 pt-4" onSubmit={event => {
        event.preventDefault(); resolve.mutate({ id: row.id, response: response.trim() }, { onSuccess: () => { setSelected(null); setResponse('') } })
      }}>
        <p className="text-xs leading-5 text-ink-soft">Record the investigation and outcome. If money needs correcting, use the period adjustment controls first. Resolving this request does not issue a credit or change an invoice.</p>
        <label className="block text-xs font-medium">Response visible to the agency<textarea className={`${operatorInput} mt-2`} rows={4} value={response} minLength={10} maxLength={1000} required disabled={resolve.isPending} onChange={event => setResponse(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2"><button className={`${operatorPrimaryButton} !text-xs`} disabled={resolve.isPending || response.trim().length < 10}>{resolve.isPending ? 'Saving response…' : 'Save response and resolve'}</button><button type="button" className={`${operatorButton} !text-xs`} disabled={resolve.isPending} onClick={() => { setSelected(null); setResponse(''); resolve.reset() }}>Cancel</button></div>
        {resolve.isError && <p role="alert" className="text-sm text-[#923511]">{resolve.error.message}</p>}
      </form>}
    </article>)}</div>}
    {queue.isSuccess && queue.data.has_more && <p className="mt-4 text-xs text-ink-soft">The oldest 100 requests are shown. Resolve reviewed requests to reveal the remainder.</p>}
    <p className="mt-4 text-xs leading-5 text-ink-soft">Review the agency’s billing history before recording an outcome.</p>
  </section>
}
