import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/stores/auth'
import { billingApi } from '@/features/billing/api'

export function BillingSection() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const { data: b } = useQuery({
    queryKey:  ['billing-status', user?.id],
    queryFn:   billingApi.getStatus,
    staleTime: 5 * 60 * 1000,
  })

  async function handleSubscribe() {
    setLoading(true)
    try { const { url } = await billingApi.createCheckoutSession(); window.location.href = url }
    catch { setLoading(false) }
  }

  async function openPortal() {
    setLoading(true)
    try { const { url } = await billingApi.createPortalSession(); window.location.href = url }
    catch { setLoading(false) }
  }

  const isActive  = b?.subscription_status === 'active'
  const isTrial   = b?.is_trial_active && !isActive
  const isPastDue = b?.subscription_status === 'past_due'

  const renewsDate = b?.subscription_current_period_end
    ? new Date(b.subscription_current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const trialEndDate = b?.trial_ends_at
    ? new Date(b.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  return (
    <div className="space-y-5">

      {/* ── Hero plan card ─────────────────────────────────────────── */}
      <div className="bg-ink text-cream p-7 relative">
        {/* corner marks */}
        <span className="absolute top-2 left-2 border-t border-l border-cream/20 w-3 h-3" />
        <span className="absolute top-2 right-2 border-t border-r border-cream/20 w-3 h-3" />
        <span className="absolute bottom-2 left-2 border-b border-l border-cream/20 w-3 h-3" />
        <span className="absolute bottom-2 right-2 border-b border-r border-cream/20 w-3 h-3" />

        <div className="grid grid-cols-[1fr_auto] gap-8 items-start">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-4 h-px bg-mint" />
              <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-mint">Your plan</p>
            </div>

            {isActive && (
              <>
                <h3 className="font-serif text-[48px] leading-none font-medium tracking-[-0.02em]">
                  Monthly <span className="font-serif italic text-mint">Subscription.</span>
                </h3>
                <p className="font-mono text-[11px] text-cream/60 mt-3 max-w-sm leading-relaxed">
                  Full access to scheduling, timesheets, client management, and all future features.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="font-mono text-[9px] tracking-[0.1em] uppercase border border-mint text-mint px-2.5 py-1">All features</span>
                  <span className="font-mono text-[9px] tracking-[0.1em] uppercase border border-mint text-mint px-2.5 py-1">Unlimited clients</span>
                  <span className="font-mono text-[9px] tracking-[0.1em] uppercase border border-cream/30 text-cream/50 px-2.5 py-1">$700 / month</span>
                </div>
              </>
            )}

            {isTrial && (
              <>
                <h3 className="font-serif text-[48px] leading-none font-medium tracking-[-0.02em]">
                  Free <span className="font-serif italic text-orange">Trial.</span>
                </h3>
                <p className="font-mono text-[11px] text-cream/60 mt-3 max-w-sm leading-relaxed">
                  {b?.trial_days_left} days remaining — trial ends {trialEndDate}. Subscribe to keep your data and access.
                </p>
              </>
            )}

            {!b?.has_access && !isTrial && (
              <>
                <h3 className="font-serif text-[48px] leading-none font-medium tracking-[-0.02em]">
                  Access <span className="font-serif italic text-orange">Expired.</span>
                </h3>
                <p className="font-mono text-[11px] text-cream/60 mt-3 max-w-sm leading-relaxed">
                  Your trial has ended. Subscribe to restore full access.
                </p>
              </>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 shrink-0">
            <div>
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-mint mb-1.5">Status</p>
              <div className="font-mono text-[13px] flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-mint' : isPastDue ? 'bg-orange' : 'bg-cream/40'}`} />
                {isActive ? 'ACTIVE' : isPastDue ? 'PAST DUE' : isTrial ? 'TRIAL' : 'INACTIVE'}
              </div>
            </div>
            {isActive && (
              <div>
                <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-mint mb-1.5">Renews</p>
                <p className="font-mono text-[13px]">{renewsDate}</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-6 pt-5 border-t border-dashed border-cream/20 flex items-center justify-between gap-4">
          <p className="font-mono text-[9px] tracking-[0.08em] text-cream/30 uppercase">
            Powered by Stripe
          </p>
          {isActive || isPastDue ? (
            <button
              onClick={openPortal}
              disabled={loading}
              className="border border-cream/30 hover:border-cream px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-cream hover:bg-cream/10 disabled:opacity-40 transition-all rounded-full"
            >
              {loading ? 'Loading…' : '＊ Manage billing in Stripe →'}
            </button>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="bg-orange border border-orange px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-white hover:opacity-80 disabled:opacity-40 transition-opacity rounded-full"
            >
              {loading ? 'Loading…' : '＊ Subscribe — $700/mo →'}
            </button>
          )}
        </div>
      </div>

      {/* ── A · Payment method ────────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="flex items-start justify-between px-6 py-5 border-b border-ink">
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">A · Payment method</p>
            <h3 className="font-serif text-[22px] leading-none font-medium mt-1">Card on file</h3>
          </div>
          {(isActive || isPastDue) && (
            <button
              onClick={openPortal}
              disabled={loading}
              className="border border-ink px-4 py-1.5 font-mono text-[10px] tracking-[0.06em] uppercase hover:bg-cream-2 disabled:opacity-40 transition-colors rounded-full"
            >
              Update card →
            </button>
          )}
        </div>
        <div className="px-6 py-5">
          {isActive || isPastDue ? (
            <p className="font-mono text-[11px] text-ink-soft">
              Card details and billing address are managed securely in the Stripe customer portal.
              Click <span className="text-ink">"Update card →"</span> above to view or change your payment method.
            </p>
          ) : (
            <p className="font-mono text-[11px] text-ink-soft">No payment method on file. Subscribe to add one.</p>
          )}
        </div>
      </div>

      {/* ── B · Invoice history ───────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="flex items-start justify-between px-6 py-5 border-b border-ink">
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">B · Invoice history</p>
            <h3 className="font-serif text-[22px] leading-none font-medium mt-1">Past invoices</h3>
          </div>
          {(isActive || isPastDue) && (
            <button
              onClick={openPortal}
              disabled={loading}
              className="border border-ink px-4 py-1.5 font-mono text-[10px] tracking-[0.06em] uppercase hover:bg-cream-2 disabled:opacity-40 transition-colors rounded-full"
            >
              Download all →
            </button>
          )}
        </div>
        <div className="px-6 py-5">
          {isActive || isPastDue ? (
            <p className="font-mono text-[11px] text-ink-soft">
              Full invoice history with PDF downloads is available in the Stripe customer portal.
              Click <span className="text-ink">"Download all →"</span> above to access your invoices.
            </p>
          ) : (
            <p className="font-mono text-[11px] text-ink-soft">No invoices yet.</p>
          )}
        </div>
      </div>

    </div>
  )
}
