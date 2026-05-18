import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PlanCard }            from '@/features/billing/components/PlanCard'
import { UpgradeCheckoutForm } from '@/features/billing/components/UpgradeCheckoutForm'

export const Route = createFileRoute('/_protected/upgrade')({
  component: UpgradePage,
})

function UpgradePage() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ['billing-status'] })
    queryClient.invalidateQueries({ queryKey: ['billing-details'] })
    navigate({ to: '/settings' })
  }

  return (
    <div className="min-h-full bg-cream">

      {/* Page header */}
      <div className="px-10 max-md:px-6 pt-8 pb-7 border-b border-ink">
        <button
          onClick={() => navigate({ to: '/settings' })}
          className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors mb-6 block"
        >
          ← Settings
        </button>
        <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft mb-2">
          <span className="inline-block w-4 h-px bg-ink align-middle mr-2" />
          Section 04 · Subscribe
        </p>
        <h1 className="font-serif text-[48px] max-md:text-[36px] leading-[0.98] font-medium tracking-[-0.02em]">
          Subscribe to <span className="font-serif italic text-muted">Homecare OS.</span>
        </h1>
        <p className="font-mono text-[11px] text-ink-soft mt-3 max-w-lg leading-relaxed">
          The all-in-one platform for home care agencies. One plan, everything included.
        </p>
      </div>

      {/* Content */}
      <div className="px-10 max-md:px-6 py-10">
        {!showForm ? (

          /* ── Step 1: Plan card ───────────────────────────────────── */
          <div className="max-w-md">
            <PlanCard onGetStarted={() => setShowForm(true)} />
          </div>

        ) : (

          /* ── Step 2: Plan summary + payment form ─────────────────── */
          <div className="grid grid-cols-[1fr_1fr] max-lg:grid-cols-1 gap-10 max-w-4xl">

            {/* Left — Plan summary */}
            <div className="border border-ink bg-paper">
              <div className="px-8 py-6 border-b border-ink">
                <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft mb-3">
                  Order summary
                </p>
                <div className="flex items-end gap-2">
                  <span className="font-serif text-[48px] leading-none font-medium tracking-[-0.02em]">
                    $700
                  </span>
                  <span className="font-mono text-[12px] text-ink-soft mb-1.5">USD / month</span>
                </div>
              </div>
              <div className="px-8 py-6 space-y-2.5">
                <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-4">
                  What's included
                </p>
                {[
                  'Unlimited workers & client profiles',
                  'Shift scheduling & calendar view',
                  'Attendance & leave tracking',
                  'Bi-weekly timesheet export',
                  'Progress notes per visit',
                  'Team invitations & roles',
                  'All future features',
                ].map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <span className="font-mono text-[10px] text-mint mt-px shrink-0">✓</span>
                    <p className="font-mono text-[10px] leading-snug text-ink-soft">{f}</p>
                  </div>
                ))}
              </div>
              <div className="px-8 py-4 border-t border-dashed border-line-soft">
                <button
                  onClick={() => setShowForm(false)}
                  className="font-mono text-[9px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
                >
                  ← Back to plan
                </button>
              </div>
            </div>

            {/* Right — Payment form */}
            <div className="border border-ink bg-paper">
              <div className="px-8 py-6 border-b border-ink">
                <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft mb-1">
                  Payment details
                </p>
                <h2 className="font-serif text-[22px] leading-none font-medium mt-1">
                  Card information
                </h2>
              </div>
              <div className="px-8 py-6">
                <UpgradeCheckoutForm onSuccess={handleSuccess} />
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  )
}
