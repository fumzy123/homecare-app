import { useState } from 'react'
import type { ReadyBillingUsage } from '../api'
import { usageDate, usageMoney, visitWallTime } from '../utils/usage-format'

const statusLabels = { scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', no_show: 'No-show' }
const pageSize = 25

// Layer 2: renders supplied billing data; local state is search/pagination only.
export function BillingUsageDetails({ data }: { data: ReadyBillingUsage }) {
  const { period, usage } = data
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const filtered = usage.clients.filter(client => `${client.client_name ?? ''} ${client.client_id}`.toLowerCase().includes(search.toLowerCase().trim()))
    .sort((a, b) => (a.client_name ?? a.client_id).localeCompare(b.client_name ?? b.client_id) || a.client_id.localeCompare(b.client_id))
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const displayed = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const money = (cents: number) => usageMoney(cents, period.currency)

  return <div className="space-y-5">
    <div className="space-y-1 text-sm">
      <p><strong>Period:</strong> {usageDate(period.starts_at, period.agency_timezone)} → {usageDate(period.ends_at, period.agency_timezone)}</p>
      <p>Agency timezone: {period.agency_timezone}. Visits starting exactly at the end belong to the next period.</p>
      <p className="text-ink-soft">Calculated {usageDate(usage.calculated_at, period.agency_timezone)}</p>
    </div>
    <dl className="grid gap-4 sm:grid-cols-3">
      <div className="border border-line-soft p-4"><dt className="text-sm text-ink-soft">Active clients</dt><dd className="text-3xl font-serif">{usage.active_client_count}</dd></div>
      <div className="border border-line-soft p-4"><dt className="text-sm text-ink-soft">Included each month</dt><dd className="text-3xl font-serif">{period.included_clients}</dd></div>
      <div className="border border-line-soft p-4"><dt className="text-sm text-ink-soft">Additional clients</dt><dd className="text-3xl font-serif">{usage.additional_clients}</dd></div>
    </dl>
    <div className="bg-cream-2 border border-line-soft p-4 space-y-2">
      <p className="font-semibold">Estimated additional-client charge: {money(usage.estimated_usage_amount_cents)}</p>
      <p>{usage.additional_clients} additional clients × {money(period.additional_client_amount_cents)} per client.</p>
      <p className="text-sm">This estimate can rise or fall as visits change. It excludes your base subscription, taxes and adjustments.</p>
      {period.base_interval === 'year' && <p className="text-sm">Your base subscription is billed annually. The client allowance and additional-client charges are calculated monthly.</p>}
      <p className="text-sm">The correction window ends {usageDate(period.finalization_eligible_at, period.agency_timezone)}. This is not a finalized invoice.</p>
    </div>
    <div className="space-y-3">
      <h3 className="font-semibold">Clients counted this period</h3>
      <p className="text-sm">Each client counts once. One qualifying visit is shown as evidence, even if they have many visits. Scheduled, in-progress, completed and no-show visits count; canceled and dropped visits do not.</p>
      {usage.active_client_count === 0 ? <p className="border border-dashed border-line-soft p-4">No clients have a qualifying visit in this period yet.</p> : <>
        <label className="block text-sm">Find a client
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} className="block border border-ink p-2 mt-1 w-full sm:max-w-sm" placeholder="Name or client ID" />
        </label>
        {filtered.length === 0 ? <p>No counted clients match your search.</p> : <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Counted clients and qualifying visits in {period.agency_timezone}</caption>
              <thead className="border-b border-ink"><tr><th scope="col" className="py-3 pr-4">Client</th><th scope="col" className="py-3 pr-4">Qualifying visit · agency time</th><th scope="col" className="py-3">Visit status</th></tr></thead>
              <tbody>{displayed.map(client => <tr key={client.client_id} className="border-b border-line-faint">
                <td className="py-3 pr-4"><span>{client.client_name || 'Client record unavailable'}</span>{client.client_archived && <span className="ml-2 text-xs text-ink-soft">Archived</span>}
                  {!client.client_name && <span className="block text-xs text-ink-soft">{client.client_id}</span>}</td>
                <td className="py-3 pr-4 whitespace-nowrap">{visitWallTime(client.local_start)}{client.occurrence_date !== client.local_start.slice(0, 10) && <span className="block text-xs text-ink-soft">Rescheduled from {client.occurrence_date}</span>}</td>
                <td className="py-3 whitespace-nowrap">{statusLabels[client.completion_status]}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <p>{filtered.length} matching clients · Page {currentPage + 1} of {pages}</p>
            <button className="border border-ink px-3 py-1 disabled:opacity-40" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
            <button className="border border-ink px-3 py-1 disabled:opacity-40" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button>
          </div>
        </>}
      </>}
    </div>
  </div>
}
