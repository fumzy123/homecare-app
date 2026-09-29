import { isAxiosError } from 'axios'
import type { BillingStatus } from '../api'
import { useBillingUsage } from '../hooks/useBillingUsage'
import { useAuthStore } from '@/shared/stores/auth'
import { BillingUsageDetails } from './BillingUsageDetails'
import { usageMoney } from '../utils/usage-format'

// Layer 3: owns query orchestration; the details view receives data as props.
export function BillingUsageSection({ status, compact = false }: { status: BillingStatus; compact?: boolean }) {
  const userId = useAuthStore(state => state.user?.id)
  const query = useBillingUsage(userId, status.billing_timezone, status.subscription_status)
  const reviewRequired = isAxiosError(query.error) && query.error.response?.status === 409

  return <section className={compact ? 'space-y-4 rounded-xl border border-line-soft bg-paper p-6' : 'space-y-5 border border-ink bg-paper p-6'} aria-label="Monthly client usage">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className={compact ? 'font-semibold text-lg' : 'font-serif text-3xl'}>Monthly client usage</h2>
      {status.billing_timezone && <button className="text-sm underline disabled:opacity-40" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Refreshing…' : 'Refresh'}</button>}
    </div>
    {!status.billing_timezone ? <p>An agency timezone must be saved above before usage can be shown.</p>
      : query.isPending ? <p role="status">Calculating current client usage…</p>
        : query.isError ? <div role="alert" className="space-y-2">
          <p>{reviewRequired ? 'The billing period or visit times need review before we can show a reliable estimate. Contact Care Harbor support.' : 'We could not update usage. Try refreshing again.'}</p>
          <p>Previous figures are hidden until the estimate can be verified.</p>
        </div>
          : query.data?.state === 'not_started' ? <p className="text-sm text-ink-soft">Usage charges start after your trial.</p>
            : query.data?.state === 'no_current_period' ? <p>There is no current paid usage period. Your invoices remain available in Billing.</p>
              : query.data?.state === 'ready' ? compact ? <>
                <dl className="grid grid-cols-2 gap-6">
                  <div><dt className="text-sm text-ink-soft">Active clients</dt><dd className="text-3xl font-semibold mt-1">{query.data.usage.active_client_count}</dd><p className="text-sm text-ink-soft mt-1">{query.data.period.included_clients} included · {query.data.usage.additional_clients} additional</p></div>
                  <div><dt className="text-sm text-ink-soft">Estimated usage charge</dt><dd className="text-3xl font-semibold mt-1">{usageMoney(query.data.usage.estimated_usage_amount_cents, query.data.period.currency)}</dd><p className="text-sm text-ink-soft mt-1">Excludes base subscription and tax</p></div>
                </dl>
                <details className="border-t border-line-soft pt-4"><summary className="cursor-pointer text-sm font-medium">View counted clients and calculation</summary><div className="mt-5"><BillingUsageDetails key={query.data.period.id} data={query.data} /></div></details>
              </> : <BillingUsageDetails key={query.data.period.id} data={query.data} /> : null}
  </section>
}
