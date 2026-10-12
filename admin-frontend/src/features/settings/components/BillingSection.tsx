import { useAuthStore } from '@/shared/stores/auth'
import { useBillingStatus } from '@/features/billing/hooks/useBillingStatus'
import { BillingOverview } from '@/features/billing/components/BillingOverview'
import { OperatorBillingLink } from '@/features/billing/components/BillingOperatorPage'

export function BillingSection() {
  const user = useAuthStore(s => s.user)
  const { data, isPending, isError, refetch } = useBillingStatus(user?.id)
  if (isPending) return <p role="status">Loading billing…</p>
  if (isError) return <p role="alert">Could not load billing. <button className="underline" onClick={() => void refetch()}>Retry</button></p>
  return <div className="space-y-8"><BillingOverview status={data} /><OperatorBillingLink /></div>
}
