import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { PlanCard }            from '@/features/billing/components/PlanCard'
import { UpgradeCheckoutForm } from '@/features/billing/components/UpgradeCheckoutForm'

export const Route = createFileRoute('/_protected/upgrade')({
  component: UpgradePage,
})

function UpgradePage() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ['billing-status'] })
    queryClient.invalidateQueries({ queryKey: ['billing-details'] })
    navigate({ to: '/settings/billing' })
  }

  return (
    <div className="min-h-screen bg-cream px-6 py-8 flex flex-col">

      {/* Close button — top right */}
      <div className="flex justify-end">
        <button
          onClick={() => navigate({ to: '/settings/billing' })}
          className="flex items-center justify-center w-10 h-10 border border-ink bg-paper hover:bg-cream-2 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-start pt-14 pb-16">

        {/* Heading */}
        <div className="text-center mb-10 max-w-lg">
          <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-ink-soft mb-4">
            Standard plan · Homecare OS
          </p>
          <h1 className="font-serif text-[52px] max-md:text-[38px] leading-[0.96] font-medium tracking-[-0.02em]">
            Subscribe to{' '}
            <span className="font-serif italic text-muted">Homecare OS.</span>
          </h1>
          <p className="font-mono text-[11px] text-ink-soft mt-4 leading-relaxed">
            The all-in-one platform for home care agencies. One plan, everything included.
          </p>
        </div>

        {/* Step 1 — Plan card */}
        {!showForm && (
          <div className="w-full max-w-sm">
            <PlanCard onGetStarted={() => setShowForm(true)} />
          </div>
        )}

        {/* Step 2 — Payment panel */}
        {showForm && (
          <div className="w-full max-w-lg border border-ink bg-paper">

            {/* Order summary */}
            <div className="px-8 py-6 border-b border-ink flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-1">
                  Order summary
                </p>
                <p className="font-mono text-[12px]">Standard · Monthly</p>
              </div>
              <div className="text-right">
                <span className="font-serif text-[32px] leading-none font-medium">$700</span>
                <span className="font-mono text-[11px] text-ink-soft ml-1">/ mo</span>
              </div>
            </div>

            {/* Payment form */}
            <div className="px-8 py-7">
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-5">
                Payment details
              </p>
              <UpgradeCheckoutForm onSuccess={handleSuccess} />
            </div>

            {/* Back to plan */}
            <div className="px-8 pb-6 border-t border-line-faint pt-4">
              <button
                onClick={() => setShowForm(false)}
                className="font-mono text-[9px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
              >
                ← Back to plan
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
