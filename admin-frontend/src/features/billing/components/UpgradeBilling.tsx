import { useAuthStore } from '@/shared/stores/auth'
import { useBillingStatus } from '../hooks/useBillingStatus'
import { BillingOnboardingPanel } from './BillingOnboardingPanel'
import { CompareBillingPlans } from './CompareBillingPlans'

export function UpgradeBilling() {
  const user = useAuthStore(s => s.user)
  const status = useBillingStatus(user?.id)
  if (status.isPending) return <p>Loading billing…</p>
  if (status.isError) return <div role="alert"><p>Could not load billing.</p><button className="underline" onClick={() => void status.refetch()}>Retry</button></div>
  // An incomplete subscription still needs its first payment. Keep the same
  // onboarding component mounted so a status refresh cannot discard checkout.
  const needsCheckout = !status.data.subscription_status || status.data.subscription_status === 'incomplete'
  return needsCheckout ? <BillingOnboardingPanel status={status.data} /> : <CompareBillingPlans status={status.data} />
}
