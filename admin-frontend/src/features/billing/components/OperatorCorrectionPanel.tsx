import { useRef, useState } from 'react'
import { useAuthStore } from '@/shared/stores/auth'
import { useOperatorPeriod } from '../hooks/useBillingOperator'
import { usageMoney } from '../utils/usage-format'
import type { OperatorCorrection } from '../operator-api'

const button = 'border border-ink rounded-full px-4 py-2 text-sm disabled:opacity-40'

// Layer 2: the exact proposal being reviewed, with no fetching or actions.
export function OperatorCorrectionSummary({ row }: { row: OperatorCorrection }) {
  return <div className="space-y-2">
    <h4 className="font-semibold">{row.amount_cents < 0 ? 'Credit' : row.amount_cents > 0 ? 'Additional charge' : 'No charge change'} · {usageMoney(Math.abs(row.amount_cents), row.currency)} · {row.status}</h4>
    <p>Clients: {row.payload.baseline_clients.length} → {row.payload.corrected_clients.length}. Included: {row.payload.included_clients}. Rate: {usageMoney(row.payload.additional_client_amount_cents, row.currency)} per additional client.</p>
    <p>Usage total: {usageMoney(row.payload.baseline_usage_amount_cents, row.currency)} → {usageMoney(row.payload.corrected_usage_amount_cents, row.currency)} before tax.</p>
    <p className="whitespace-pre-wrap break-words">Proposal reason: {row.reason}</p>
    {row.decision_reason && <p className="whitespace-pre-wrap break-words">Decision: {row.decision_reason}</p>}
    <details><summary className="cursor-pointer underline">Review changed client references</summary>
      <p className="break-all">Added: {row.payload.added_client_ids.join(', ') || 'None'}</p>
      <p className="break-all">Removed: {row.payload.removed_client_ids.join(', ') || 'None'}</p>
    </details>
    <p>Settlement: {row.settlement_status.replaceAll('_', ' ')}.</p>
  </div>
}

interface ReviewProps { row: OperatorCorrection; busy: boolean; onDecision: (decision: 'approved' | 'rejected', reason: string) => void }

export function OperatorCorrectionReview({ row, busy, onDecision }: ReviewProps) {
  return <article className="border border-line-soft p-4">
    <OperatorCorrectionSummary row={row} />
    {row.status === 'pending' && <DecisionForm row={row} busy={busy} onDecision={onDecision} />}
  </article>
}

function DecisionForm({ row, busy, onDecision }: ReviewProps) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  return <form className="space-y-3 mt-4" onSubmit={event => { event.preventDefault(); if (confirmed) onDecision('approved', reason.trim()) }}>
    <label className="block">Decision reason (no care details)
      <textarea className="block border border-ink p-2 w-full" value={reason} minLength={5} maxLength={1000} required disabled={busy} onChange={e => setReason(e.target.value)} />
    </label>
    <label className="flex gap-2 items-start"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /><span>I reviewed this agency, period, client changes, and {usageMoney(row.amount_cents, row.currency)} adjustment. Approval authorizes settlement when billing is enabled.</span></label>
    <div className="flex gap-3 flex-wrap">
      <button className={button} disabled={busy || !confirmed || reason.trim().length < 5} type="submit">Approve {usageMoney(row.amount_cents, row.currency)}</button>
      <button className={button} disabled={busy || reason.trim().length < 5} type="button" onClick={() => onDecision('rejected', reason.trim())}>Reject proposal</button>
    </div>
  </form>
}

export function OperatorCorrectionPanel({ org, period }: { org: string; period: string }) {
  const userId = useAuthStore(s => s.user?.id)
  const { corrections, settlements, propose, decide } = useOperatorPeriod(userId, org, period)
  const [reason, setReason] = useState('')
  const requestId = useRef<string | null>(null)
  const busy = propose.isPending || decide.isPending
  const error = propose.error ?? decide.error
  return <section className="space-y-4 border border-ink p-4" aria-label="Correction review">
    <h3 className="font-serif text-xl">Correction review</h3>
    <p>Correct the agency’s visit records first. A proposal compares the corrected client list with the last approved total using the original rates. Creating a proposal does not approve it.</p>
    <form className="space-y-3" onSubmit={async event => {
      event.preventDefault()
      requestId.current ??= crypto.randomUUID()
      try { await propose.mutateAsync({ request_id: requestId.current, reason: reason.trim() }); setReason(''); requestId.current = null } catch { /* Keep the same request ID for a safe retry. */ }
    }}>
      <label className="block">Proposal reason (no care details)<textarea className="block w-full border border-ink p-2" value={reason} minLength={5} maxLength={1000} required disabled={busy} onChange={e => { setReason(e.target.value); requestId.current = null }} /></label>
      <button className={button} disabled={busy || reason.trim().length < 5}>Calculate and save proposal</button>
    </form>
    {error && <p role="alert">{error.message} Refresh the review before retrying an uncertain result.</p>}
    {decide.isSuccess && <p role="status">Decision recorded. Approval does not confirm payment or refund completion.</p>}
    <button className={button} disabled={busy || corrections.isFetching || settlements.isFetching} onClick={() => { void corrections.refetch(); void settlements.refetch() }}>Refresh review</button>
    {corrections.isPending && <p>Loading proposals…</p>}
    {corrections.isError && <p role="alert">Could not load proposals. Refresh to retry.</p>}
    {!corrections.isError && corrections.data?.adjustments.length === 0 && <p>No proposals for this period.</p>}
    {!corrections.isError && corrections.data?.adjustments.map(row => <OperatorCorrectionReview key={row.id} row={row} busy={busy || corrections.isFetching}
      onDecision={(decision, reason) => decide.mutate({ id: row.id, decision, reason })} />)}
    <h4 className="font-semibold">Payment / refund records</h4>
    {settlements.isPending && <p>Loading settlement records…</p>}
    {settlements.isError && <p role="alert">Could not load settlement records.</p>}
    {!settlements.isError && settlements.data?.map(row => <p key={row.id}>{usageMoney(row.amount_cents, row.currency)} · {row.state.replaceAll('_', ' ')} · {row.payment_status?.replaceAll('_', ' ') ?? 'Not completed'}{row.invoice_id && ` · ${row.invoice_id}`}</p>)}
    <details><summary className="cursor-pointer underline">Decision audit trail</summary>
      {corrections.data?.events.map(event => <p key={event.id} className="my-2 break-words">{new Date(event.occurred_at).toLocaleString()} · {event.action} · Operator {event.actor_id}: {event.reason}</p>)}
    </details>
  </section>
}
