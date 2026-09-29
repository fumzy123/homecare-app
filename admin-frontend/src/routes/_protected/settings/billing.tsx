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
        title="Billing"
        sub="Your plan, usage, and invoices."
      />
      <BillingSection />
    </>
  )
}
