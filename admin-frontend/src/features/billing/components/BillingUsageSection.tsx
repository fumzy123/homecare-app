import { isAxiosError } from 'axios'
import type { BillingStatus } from '../api'
import { useBillingUsage } from '../hooks/useBillingUsage'
import { useAuthStore } from '@/shared/stores/auth'
import { BillingUsageDetails } from './BillingUsageDetails'

// Layer 3: owns query orchestration; the details view receives data as props.
export function BillingUsageSection({ status }: { status: BillingStatus }) {
  const userId = useAuthStore(state => state.user?.id)
  const query = useBillingUsage(userId, status.billing_timezone, status.subscription_status)
  const reviewRequired = isAxiosError(query.error) && query.error.response?.status === 409

  return <section className="space-y-5 border border-ink bg-paper p-6" aria-label="Monthly client usage">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-serif text-3xl">Monthly client usage</h2>
      {status.billing_timezone && <button className="border border-ink px-4 py-2 disabled:opacity-40" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Refreshing…' : 'Refresh usage'}</button>}
    </div>
    {!status.billing_timezone ? <p>An agency timezone must be saved above before usage can be shown.</p>
      : query.isPending ? <p role="status">Calculating current client usage…</p>
        : query.isError ? <div role="alert" className="space-y-2">
          <p>{reviewRequired ? 'The billing period or visit times need review before we can show a reliable estimate. Contact Care Harbor support.' : 'We could not update usage. Try refreshing again.'}</p>
          <p>Previous figures are hidden until the estimate can be verified.</p>
        </div>
          : query.data?.state === 'not_started' ? <p>Paid client usage begins when your trial ends. Onboarding and trial visits do not generate usage charges.</p>
            : query.data?.state === 'no_current_period' ? <p>There is no current paid usage period. Your invoices remain available in Billing.</p>
              : query.data?.state === 'ready' ? <BillingUsageDetails key={query.data.period.id} data={query.data} /> : null}
  </section>
}
