import { useState } from 'react'
import { useAuthStore } from '@/shared/stores/auth'
import { useInvoiceHistory, usePeriodHistory, useUsageHistory } from '../hooks/useBillingHistory'
import { usageDate, usageMoney } from '../utils/usage-format'
import type { BillingSettlement } from '../api'

const button = 'border border-ink rounded-full px-4 py-2 text-sm disabled:opacity-40'

function settlementLabel(row: BillingSettlement): string {
  if (row.state === 'needs_review') return 'Support review required'
  if (row.payment_status === 'refund_pending') return 'Refund processing'
  if (row.state === 'credited') return 'Credit applied / refund issued'
  if (row.payment_status === 'paid') return 'Paid'
  if (row.payment_status === 'open') return 'Payment outstanding'
  if (row.state === 'zero') return 'No usage payment required'
  return 'Processing — not yet confirmed'
}

export function InvoiceHistorySection() {
  const userId = useAuthStore(s => s.user?.id)
  const query = useInvoiceHistory(userId)
  const invoices = query.data?.pages.flatMap(page => page.invoices) ?? []
  return <section className="border border-ink bg-paper p-6 space-y-4" aria-label="Invoice history">
    <div className="flex flex-wrap justify-between gap-3">
      <h2 className="font-serif text-2xl">Invoice history</h2>
      <button className={button} disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh invoices</button>
    </div>
    <p className="text-sm text-ink-soft">Invoice totals include applicable taxes. Open an invoice to see its charges, credits, and payment options.</p>
    {query.isPending && <p role="status">Loading invoices…</p>}
    {query.isError && <p role="alert">Could not load invoices. Use Refresh invoices to try again.</p>}
    {query.isSuccess && invoices.length === 0 && <p>No invoices yet.</p>}
    {invoices.length > 0 && <div className="overflow-x-auto">
      <table className="w-full text-left text-sm min-w-[650px]">
        <caption className="sr-only">Invoices, total amounts, balances due, and payment status</caption>
        <thead><tr>{['Invoice', 'Date', 'Total', 'Amount due', 'Status', 'Details'].map(label => <th key={label} scope="col" className="py-3 pr-4 border-b border-ink">{label}</th>)}</tr></thead>
        <tbody>{invoices.map(invoice => <tr key={invoice.id}>
          <th scope="row" className="py-3 pr-4 border-b border-line-soft font-normal">{invoice.number ?? 'Draft invoice'}</th>
          <td className="py-3 pr-4 border-b border-line-soft">{new Date(invoice.created * 1000).toLocaleDateString()}</td>
          <td className="py-3 pr-4 border-b border-line-soft">{usageMoney(invoice.total, invoice.currency)}</td>
          <td className="py-3 pr-4 border-b border-line-soft">{usageMoney(invoice.amount_remaining, invoice.currency)}</td>
          <td className="py-3 pr-4 border-b border-line-soft">{({ paid: 'Paid', open: 'Payment outstanding', draft: 'Draft — not final', void: 'Voided', uncollectible: 'Uncollectible' } as Record<string, string>)[invoice.status] ?? 'Status unavailable'}</td>
          <td className="py-3 border-b border-line-soft">{invoice.hosted_invoice_url
            ? <a className="underline" href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer" aria-label={`View invoice ${invoice.number ?? ''} in Stripe`}>View in Stripe ↗</a>
            : <span className="text-ink-soft">Not available yet</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {query.hasNextPage && <button className={button} disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>Load older invoices</button>}
  </section>
}

function PeriodCorrections({ periodId, originalAmount, currency }: { periodId: string; originalAmount: number; currency: string }) {
  const userId = useAuthStore(s => s.user?.id)
  const { corrections, settlements } = usePeriodHistory(userId, periodId)
  const busy = corrections.isFetching || settlements.isFetching
  const rows = corrections.data?.adjustments ?? []
  const approved = rows.filter(row => row.status === 'approved')
  return <div className="space-y-4 border-t border-line-soft pt-4 mt-4">
    <button className={button} disabled={busy} onClick={() => { void corrections.refetch(); void settlements.refetch() }}>Refresh corrections and payments</button>
    <h3 className="font-semibold">Usage payments</h3>
    {settlements.isPending && <p role="status">Loading payment status…</p>}
    {settlements.isError && <p role="alert">Payment status could not be loaded. Try refreshing.</p>}
    {settlements.isSuccess && settlements.data.length === 0 && <p>Usage has been finalized. Payment processing has not started.</p>}
    {settlements.data?.map(row => <p key={row.id}>{row.adjustment_id ? 'Correction' : 'Original usage'}: {usageMoney(row.amount_cents, row.currency)} · {settlementLabel(row)}</p>)}
    <h3 className="font-semibold">Corrections</h3>
    <p className="text-sm text-ink-soft">Only approved corrections change your usage total. Approval does not mean a payment or refund has completed.</p>
    {corrections.isPending && <p role="status">Loading corrections…</p>}
    {corrections.isError && <p role="alert">Corrections could not be loaded. Try refreshing.</p>}
    {corrections.isSuccess && rows.length === 0 && <p>No corrections for this period.</p>}
    {corrections.isSuccess && approved.length > 0 && <div>
      <p>Approved corrections total: {usageMoney(approved.reduce((total, row) => total + row.amount_cents, 0), currency)} before tax.</p>
      <p>Usage after approved corrections: {usageMoney(originalAmount + approved.reduce((total, row) => total + row.amount_cents, 0), currency)} before tax.</p>
    </div>}
    {rows.map(row => <div key={row.id} className="border border-line-soft p-3 space-y-1">
      <p>{usageMoney(row.amount_cents, row.currency)} · {row.status === 'pending' ? 'Awaiting review' : row.status === 'approved' ? 'Approved' : 'Rejected'} · {new Date(row.proposed_at).toLocaleDateString()}</p>
      <p className="whitespace-pre-wrap break-words">{row.reason}</p>
      {row.decision_reason && <p className="whitespace-pre-wrap break-words">Review: {row.decision_reason}</p>}
      {row.status === 'approved' && row.amount_cents === 0 && <p>No payment adjustment required.</p>}
    </div>)}
  </div>
}

export function BillingUsageHistorySection() {
  const userId = useAuthStore(s => s.user?.id)
  const query = useUsageHistory(userId)
  const [selected, setSelected] = useState<string | null>(null)
  const periods = query.data?.pages.flatMap(page => page.periods) ?? []
  return <section className="border border-ink bg-paper p-6 space-y-4" aria-label="Finalized usage history">
    <div className="flex flex-wrap justify-between gap-3">
      <h2 className="font-serif text-2xl">Finalized usage history</h2>
      <button className={button} disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh usage history</button>
    </div>
    <p className="text-sm text-ink-soft">Original monthly usage totals before tax, excluding your base subscription. Corrections are listed separately. Each period ends immediately before the displayed end time.</p>
    {query.isPending && <p role="status">Loading usage history…</p>}
    {query.isError && <p role="alert">Could not load usage history. Try refreshing.</p>}
    {query.isSuccess && periods.length === 0 && <p>No finalized usage periods yet. Current usage remains an estimate until the billing cutoff.</p>}
    {periods.map(period => <article key={period.period_id} className="border border-line-soft p-4 space-y-2">
      <h3 className="font-semibold">{usageDate(period.starts_at, period.agency_timezone)} → {usageDate(period.ends_at, period.agency_timezone)}</h3>
      <p>{period.active_client_count} active clients · {period.additional_clients} additional clients · {usageMoney(period.usage_amount_cents, period.currency)} original usage</p>
      <button className={button} aria-expanded={selected === period.period_id} aria-controls={`history-${period.period_id}`} onClick={() => setSelected(selected === period.period_id ? null : period.period_id)}>
        {selected === period.period_id ? 'Hide' : 'View'} corrections and payments
      </button>
      <div id={`history-${period.period_id}`}>{selected === period.period_id && <PeriodCorrections periodId={period.period_id} originalAmount={period.usage_amount_cents} currency={period.currency} />}</div>
    </article>)}
    {query.hasNextPage && <button className={button} disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>Load older periods</button>}
  </section>
}
