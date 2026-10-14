import { useState } from 'react'
import { useAuthStore } from '@/shared/stores/auth'
import { useBillingReviews } from '../hooks/useBillingReviews'

// Layer 3: owns submitting and reading agency-scoped billing requests.
export function BillingReviewForm({ periodId }: { periodId: string }) {
  const userId = useAuthStore(state => state.user?.id)
  const { reviews, submit } = useBillingReviews(userId, periodId)
  const [message, setMessage] = useState('')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  return <section className="border-t border-line-soft pt-4 space-y-3" aria-label="Billing review requests">
    <h3 className="font-semibold">Report a billing mistake</h3>
    <p className="text-sm">Explain which count or charge needs review. Include client references if needed, but no medical details. Submitting a request does not pause billing or change the correction deadline. After finalization, approved corrections are recorded separately.</p>
    <form className="space-y-2" onSubmit={event => {
      event.preventDefault()
      submit.mutate({ request_id: requestId, message: message.trim() }, { onSuccess: () => { setMessage(''); setRequestId(crypto.randomUUID()) } })
    }}>
      <label className="block text-sm">Billing question
        <textarea required minLength={10} maxLength={1000} value={message} disabled={submit.isPending} onChange={event => {
          setMessage(event.target.value); setRequestId(crypto.randomUUID()); submit.reset()
        }} className="block w-full border border-ink p-2 mt-1" rows={3} />
      </label>
      <button className="border border-ink px-4 py-2 disabled:opacity-40" disabled={submit.isPending || message.trim().length < 10}>{submit.isPending ? 'Submitting…' : 'Submit for review'}</button>
    </form>
    {submit.isError && <p role="alert">{submit.error.message}</p>}
    {submit.isSuccess && <p role="status">Your request has been recorded for Care Harbor to review.</p>}
    <button className="underline text-sm" disabled={reviews.isFetching} onClick={() => void reviews.refetch()}>Refresh review responses</button>
    {reviews.isPending && <p role="status">Loading review requests…</p>}
    {reviews.isError && <p role="alert">Could not load review responses. Please refresh.</p>}
    {reviews.isSuccess && reviews.data.map(row => <article key={row.id} className="border border-line-soft p-3 space-y-1">
      <p className="text-sm">{row.status === 'open' ? 'Awaiting review' : 'Reviewed'} · {new Date(row.submitted_at).toLocaleString()}</p>
      <p className="whitespace-pre-wrap break-words">{row.message}</p>
      {row.response && <p className="whitespace-pre-wrap break-words"><strong>Care Harbor:</strong> {row.response}</p>}
    </article>)}
  </section>
}
