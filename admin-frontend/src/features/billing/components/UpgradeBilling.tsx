import { Link } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { useBillingStatus } from '../hooks/useBillingStatus'
import { BillingOnboardingPanel } from './BillingOnboardingPanel'

export function UpgradeBilling() {
  const user = useAuthStore(s => s.user)
  const status = useBillingStatus(user?.id)
  if (status.isPending) return <p>Loading billing…</p>
  if (status.isError) return <div role="alert"><p>Could not load billing.</p><button className="underline" onClick={() => void status.refetch()}>Retry</button></div>
  if (status.data.new_billing_flow) return <BillingOnboardingPanel status={status.data} />
  return <section className="border border-ink bg-paper p-6 space-y-4">
    <h1 className="font-serif text-3xl">Your billing options</h1>
    <p>This account has not been enrolled in the new Care Harbor plans. Contact Care Harbor to arrange onboarding and confirm your pricing before starting a new subscription.</p>
    <p>If you already have a subscription, its existing terms still apply. You can review invoices and manage payment details in Billing.</p>
    <Link to="/settings/billing" className="underline">Open Billing</Link>
  </section>
}
