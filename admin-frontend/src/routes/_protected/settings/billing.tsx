import { createFileRoute } from '@tanstack/react-router'
import { BillingSection }     from '@/features/settings/components/BillingSection'
import { SettingsPaneHeader } from '@/features/settings/components/SettingsPaneHeader'

export const Route = createFileRoute('/_protected/settings/billing')({
  component: BillingPage,
})

function BillingPage() {
  return (
    <>
      <SettingsPaneHeader
        num="03"
        title="Billing &amp; licensing"
        sub="Subscription status and payment management via Stripe."
      />
      <BillingSection />
    </>
  )
}
