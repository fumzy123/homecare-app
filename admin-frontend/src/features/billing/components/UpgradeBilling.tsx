import { useAuthStore } from '@/shared/stores/auth'
import { useBillingStatus } from '../hooks/useBillingStatus'
import { BillingOnboardingPanel } from './BillingOnboardingPanel'
import { CompareBillingPlans } from './CompareBillingPlans'

export function UpgradeBilling() {
  const user = useAuthStore(s => s.user)
  const status = useBillingStatus(user?.id)
  if (status.isPending) return <p>Loading billing…</p>
  if (status.isError) return <div role="alert"><p>Could not load billing.</p><button className="underline" onClick={() => void status.refetch()}>Retry</button></div>
  return status.data.subscription_status ? <CompareBillingPlans status={status.data} /> : <BillingOnboardingPanel status={status.data} />
}
