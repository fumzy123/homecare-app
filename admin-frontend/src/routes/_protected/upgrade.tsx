import { createFileRoute, Link } from '@tanstack/react-router'
import { UpgradeBilling } from '@/features/billing/components/UpgradeBilling'

export const Route = createFileRoute('/_protected/upgrade')({
  component: UpgradePage,
})

function UpgradePage() {
  return <main className="max-w-2xl mx-auto p-8 space-y-6">
    <Link to="/settings/billing" className="underline">Back to Billing</Link>
    <UpgradeBilling />
  </main>
}
