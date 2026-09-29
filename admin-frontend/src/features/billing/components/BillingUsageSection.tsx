import { isAxiosError } from 'axios'
import type { BillingStatus } from '../api'
import { useBillingUsage } from '../hooks/useBillingUsage'
import { useAuthStore } from '@/shared/stores/auth'
import { BillingUsageDetails } from './BillingUsageDetails'
import { BillingPanel } from './BillingPanel'
import { BillingUsageSummary, PendingUsageBalance } from './BillingUsageSummary'
import { useUpcomingBilling } from '../hooks/useUpcomingBilling'

// Layer 3: owns query orchestration; the details view receives data as props.
export function BillingUsageSection({ status, compact = false }: { status: BillingStatus; compact?: boolean }) {
  const userId = useAuthStore(state => state.user?.id)
  const query = useBillingUsage(userId, status.billing_timezone, status.subscription_status)
  const upcoming = useUpcomingBilling(userId)
  const reviewRequired = isAxiosError(query.error) && query.error.response?.status === 409

  return <BillingPanel label="Client usage" title="Monthly client usage" action={status.billing_timezone && <button className="border border-ink px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] disabled:opacity-40" disabled={query.isFetching || upcoming.isFetching} onClick={() => { void query.refetch(); void upcoming.refetch() }}>{query.isFetching || upcoming.isFetching ? 'Refreshing…' : 'Refresh'}</button>}>
    {!status.billing_timezone ? <p>An agency timezone must be saved above before usage can be shown.</p>
      : query.isPending ? <p role="status">Calculating current client usage…</p>
        : query.isError ? <div role="alert" className="space-y-2">
          <p>{reviewRequired ? 'The billing period or visit times need review before we can show a reliable estimate. Contact Care Harbor support.' : 'We could not update usage. Try refreshing again.'}</p>
          <p>Previous figures are hidden until the estimate can be verified.</p>
        </div>
          : query.data?.state === 'not_started' ? <p className="text-sm text-ink-soft">Usage charges start after your trial.</p>
            : query.data?.state === 'no_current_period' ? <>
              <p>There is no current paid usage period.</p>
              {upcoming.isSuccess ? <PendingUsageBalance upcoming={upcoming.data} timezone={status.billing_timezone} />
                : <p role="status">{upcoming.isError ? 'Pending usage could not be verified. Please refresh.' : 'Checking pending usage…'}</p>}
            </>
              : query.data?.state === 'ready' ? compact ? <>
                <BillingUsageSummary data={query.data} upcoming={!query.data.trial_preview && upcoming.isSuccess ? upcoming.data : undefined} />
                {!query.data.trial_preview && upcoming.isPending && <p role="status" className="text-sm text-ink-soft">Checking earlier usage awaiting billing…</p>}
                {!query.data.trial_preview && upcoming.isError && <p role="alert" className="text-sm">Earlier pending charges could not be verified. Refresh to check the full breakdown.</p>}
                <details className="border-t border-line-soft pt-4"><summary className="cursor-pointer text-sm font-medium">View counted clients and calculation</summary><div className="mt-5"><BillingUsageDetails key={query.data.period.id} data={query.data} /></div></details>
              </> : <BillingUsageDetails key={query.data.period.id} data={query.data} /> : null}
  </BillingPanel>
}
