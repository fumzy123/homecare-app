import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { billingApi, type CardInfo } from '@/features/billing/api'
import { UpdateCardModal } from '@/features/billing/components/UpdateCardModal'
import { useBillingStatus } from '@/features/billing/hooks/useBillingStatus'
import { useBillingDetails } from '@/features/billing/hooks/useBillingOnboarding'
import { BillingOnboardingPanel } from '@/features/billing/components/BillingOnboardingPanel'
import { BillingUsageSection } from '@/features/billing/components/BillingUsageSection'
import { BillingUsageHistorySection, InvoiceHistorySection } from '@/features/billing/components/BillingHistorySection'
import { UpcomingBillingSection } from '@/features/billing/components/UpcomingBillingSection'
import { OperatorBillingLink } from '@/features/billing/components/BillingOperatorPage'

function CardBrand({ brand }: { brand: string }) {
  const label = brand.toUpperCase() === 'MASTERCARD' ? 'MC' : brand.toUpperCase()
  return (
    <span className="inline-flex items-center justify-center border border-ink px-2 py-1 font-mono text-[10px] font-bold tracking-wider min-w-[52px]">
      {label}
    </span>
  )
}

function CardRow({ card }: { card: CardInfo }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <CardBrand brand={card.brand} />
        <div>
          <p className="font-mono text-[13px]">···· ···· ···· {card.last4}</p>
          <p className="font-mono text-[10px] text-ink-soft mt-0.5 tracking-[0.06em]">
            EXP {String(card.exp_month).padStart(2, '0')} / {String(card.exp_year).slice(-2)}
            {card.postal_code ? ` · BILLING ZIP ${card.postal_code}` : ''}
          </p>
        </div>
      </div>
      <span className="border border-line-soft text-ink-soft font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1">
        DEFAULT
      </span>
    </div>
  )
}

export function BillingSection() {
  const user = useAuthStore(s => s.user)
  const { data, isPending, isError } = useBillingStatus(user?.id)
  if (isPending) return <p>Loading billing…</p>
  if (isError) return <p role="alert">Could not load billing. Please refresh and try again.</p>
  return <div className="space-y-6">{data.new_billing_flow
    ? <><BillingOnboardingPanel status={data} /><UpcomingBillingSection timezone={data.billing_timezone} /><BillingUsageSection status={data} /><BillingUsageHistorySection /></>
    : data.subscription_status ? <LegacyBillingSection /> : <BillingOnboardingPanel status={data} />}
    <InvoiceHistorySection />
    <OperatorBillingLink />
  </div>
}

function LegacyBillingSection() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showUpdateCard, setShowUpdateCard] = useState(false)
  const [portalLoading, setPortalLoading]   = useState(false)
  const [portalError, setPortalError] = useState(false)
  const owner = user?.role === 'owner'

  const { data: b } = useBillingStatus(user?.id)

  const isActive  = b?.subscription_status === 'active'
  const isPastDue = b?.subscription_status === 'past_due'
  const isTrial   = b?.is_trial_active && !isActive

  const { data: details, isPending: detailsPending, isError: detailsError } = useBillingDetails(user?.id, b !== undefined)
  const hasBillingAccount = Boolean(b?.subscription_status || details?.card)

  async function openPortal() {
    setPortalLoading(true)
    setPortalError(false)
    try {
      const { url } = await billingApi.createPortalSession()
      window.location.href = url
    } catch {
      setPortalError(true)
      setPortalLoading(false)
    }
  }

  function handleUpdateCardSuccess() {
    setShowUpdateCard(false)
    queryClient.invalidateQueries({ queryKey: ['billing-details'] })
  }

  const renewsDate = b?.subscription_current_period_end
    ? new Date(b.subscription_current_period_end).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : '—'

  const trialEndDate = b?.trial_ends_at
    ? new Date(b.trial_ends_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : '—'

  return (
    <>
      <div className="space-y-5">

        {/* ── Hero plan card ─────────────────────────────────────────── */}
        <div className="bg-ink text-cream p-7 relative">
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
                    Existing <span className="font-serif italic text-mint">Subscription.</span>
                  </h3>
                  <p className="font-mono text-[11px] text-cream/60 mt-3 max-w-sm leading-relaxed">
                    Your existing subscription terms apply. Review invoices and your current price in Stripe, or contact Care Harbor to discuss the new plans.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="font-mono text-[9px] tracking-[0.1em] uppercase border border-mint text-mint px-2.5 py-1">Existing plan</span>
                  </div>
                </>
              )}

              {isTrial && (
                <>
                  <h3 className="font-serif text-[48px] leading-none font-medium tracking-[-0.02em]">
                    Free <span className="font-serif italic text-orange">Trial.</span>
                  </h3>
                  <p className="font-mono text-[11px] text-cream/60 mt-3 max-w-sm leading-relaxed">
                    {b?.trial_days_left} days remaining — trial ends {trialEndDate}. Contact Care Harbor to confirm your subscription options. Your records remain available to view after the trial.
                  </p>
                </>
              )}

              {!b?.has_access && !isTrial && (
                <>
                  <h3 className="font-serif text-[48px] leading-none font-medium tracking-[-0.02em]">
                    Access <span className="font-serif italic text-orange">Expired.</span>
                  </h3>
                  <p className="font-mono text-[11px] text-cream/60 mt-3 max-w-sm leading-relaxed">
                    Your account is read-only. You can view records and invoices. Review Billing to resolve payment issues, or contact Care Harbor to arrange a subscription.
                  </p>
                </>
              )}
            </div>

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
                  <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-mint mb-1.5">Current period ends</p>
                  <p className="font-mono text-[13px]">{renewsDate}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-dashed border-cream/20 flex items-center justify-between gap-4">
            <p className="font-mono text-[9px] tracking-[0.08em] text-cream/30 uppercase">
              Powered by Stripe
            </p>
            {owner && hasBillingAccount ? (
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="border border-cream/30 hover:border-cream px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-cream hover:bg-cream/10 disabled:opacity-40 transition-all rounded-full"
              >
                {portalLoading ? 'Loading…' : '＊ Manage billing in Stripe →'}
              </button>
            ) : owner ? (
              <button
                onClick={() => navigate({ to: '/upgrade' })}
                className="bg-orange border border-orange px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-white hover:opacity-80 transition-opacity rounded-full"
              >
                Review billing options →
              </button>
            ) : <p className="text-sm">Your agency owner manages payments.</p>}
          </div>
        </div>

        {/* ── A · Payment method ─────────────────────────────────────── */}
        {portalError && <p role="alert">Could not open Stripe. Please try again.</p>}
        <div className="border border-ink bg-paper">
          <div className="flex items-start justify-between px-6 py-5 border-b border-ink">
            <div>
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">A · Payment method</p>
              <h3 className="font-serif text-[22px] leading-none font-medium mt-1">Card on file</h3>
            </div>
            {owner && hasBillingAccount && b?.subscription_status !== 'canceled' && (
              <button
                onClick={() => setShowUpdateCard(true)}
                className="border border-ink px-4 py-1.5 font-mono text-[10px] tracking-[0.06em] uppercase hover:bg-cream-2 transition-colors rounded-full"
              >
                Update card →
              </button>
            )}
          </div>
          <div className="px-6 py-5">
            {details?.card ? (
              <CardRow card={details.card} />
            ) : (
              <p className="font-mono text-[11px] text-ink-soft">
                {detailsError ? 'Could not load card details. Please refresh and try again.' : detailsPending
                  ? 'Loading card details…'
                  : 'No payment method on file.'}
              </p>
            )}
          </div>
        </div>


      </div>

      {showUpdateCard && (
        <UpdateCardModal
          onClose={() => setShowUpdateCard(false)}
          onSuccess={handleUpdateCardSuccess}
        />
      )}
    </>
  )
}
