import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/stores/auth'
import { billingApi } from '@/features/billing/api'
import { Kicker } from '@/shared/components/ui'

export function BillingSection() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const { data: billingStatus } = useQuery({
    queryKey: ['billing-status', user?.id],
    queryFn:  billingApi.getStatus,
    staleTime: 5 * 60 * 1000,
  })

  async function handleSubscribe() {
    setLoading(true)
    try {
      const { url } = await billingApi.createCheckoutSession()
      window.location.href = url
    } catch { setLoading(false) }
  }

  async function handleManageBilling() {
    setLoading(true)
    try {
      const { url } = await billingApi.createPortalSession()
      window.location.href = url
    } catch { setLoading(false) }
  }

  return (
    <div className="border border-ink bg-paper mt-6">
      <div className="px-6 py-4 border-b border-ink">
        <Kicker>Billing</Kicker>
      </div>

      <div className="px-6 py-6 flex items-center justify-between gap-4">
        <div>
          {billingStatus?.subscription_status === 'active' && (
            <>
              <p className="font-mono text-[11px] tracking-[0.06em] font-bold text-ink">Active subscription</p>
              <p className="font-mono text-[10px] text-ink-soft mt-0.5">
                Renews {billingStatus.subscription_current_period_end
                  ? new Date(billingStatus.subscription_current_period_end).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
                  : '—'}
              </p>
            </>
          )}
          {billingStatus?.is_trial_active && billingStatus?.subscription_status !== 'active' && (
            <>
              <p className="font-mono text-[11px] tracking-[0.06em] font-bold text-orange">Free trial</p>
              <p className="font-mono text-[10px] text-ink-soft mt-0.5">{billingStatus.trial_days_left} days remaining</p>
            </>
          )}
          {!billingStatus?.has_access && (
            <>
              <p className="font-mono text-[11px] tracking-[0.06em] font-bold text-orange">Trial expired</p>
              <p className="font-mono text-[10px] text-ink-soft mt-0.5">Subscribe to restore access</p>
            </>
          )}
        </div>

        {billingStatus?.subscription_status === 'active' ? (
          <button
            onClick={handleManageBilling}
            disabled={loading}
            className="shrink-0 border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-cream-2 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Loading…' : 'Manage Billing'}
          </button>
        ) : (
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="shrink-0 bg-orange text-white px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {loading ? 'Loading…' : 'Subscribe — $700/mo'}
          </button>
        )}
      </div>
    </div>
  )
}
