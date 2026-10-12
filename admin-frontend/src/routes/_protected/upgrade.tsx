import { createFileRoute, Link } from '@tanstack/react-router'
import { UpgradeBilling } from '@/features/billing/components/UpgradeBilling'

export const Route = createFileRoute('/_protected/upgrade')({
  component: UpgradePage,
})

function UpgradePage() {
  return <main className="max-w-6xl mx-auto px-5 py-8 sm:px-10 sm:py-12 space-y-8">
    <Link to="/settings/billing" className="text-sm text-ink-soft underline underline-offset-4">← Back to Billing</Link>
    <header className="pt-4 text-center">
      <p className="mb-4 font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">Care Harbor · Plans & billing</p>
      <h1 className="font-serif text-4xl sm:text-6xl leading-tight tracking-tight">Room for your agency <span className="italic">to grow.</span></h1>
      <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-soft">Review your plan, estimate your costs, and manage your subscription.</p>
    </header>
    <UpgradeBilling />
  </main>
}
