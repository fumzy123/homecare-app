import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/stores/auth'
import { billingApi, type CardInfo, type Invoice } from '@/features/billing/api'
import { CheckoutModal } from '@/features/billing/components/CheckoutModal'
import { UpdateCardModal } from '@/features/billing/components/UpdateCardModal'

function CardBrand({ brand }: { brand: string }) {
  const label = brand.toUpperCase() === 'MASTERCARD' ? 'MC' : brand.toUpperCase()
  return (
    <span className="inline-flex items-center justify-center border border-ink px-2 py-1 font-mono text-[10px] font-bold tracking-wider min-w-[52px]">
      {label}
    </span>
  )
}

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
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

function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <>
      <div className="grid grid-cols-[1.4fr_1fr_2fr_1fr_72px_52px] px-6 py-3 border-b border-ink bg-cream-2">
        {['Invoice', 'Date', 'Description', 'Amount', 'Status', ''].map(h => (
          <p key={h} className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">{h}</p>
        ))}
      </div>
      {invoices.map((inv, i) => (
        <div
          key={inv.id}
          className={`grid grid-cols-[1.4fr_1fr_2fr_1fr_72px_52px] items-center px-6 py-3 ${
            i > 0 ? 'border-t border-dashed border-line-soft' : ''
          }`}
        >
          <p className="font-mono text-[10px] text-ink-soft truncate pr-2">{inv.id}</p>
          <p className="font-mono text-[11px]">{formatDate(inv.created)}</p>
          <p className="font-mono text-[11px] truncate pr-2">{inv.description}</p>
          <p className="font-mono text-[11px]">{formatAmount(inv.amount_paid, inv.currency)}</p>
          <div>
            {inv.status === 'paid' ? (
              <span className="bg-mint text-ink font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-0.5">
                PAID
              </span>
            ) : (
              <span className="border border-line-soft text-ink-soft font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-0.5">
                {inv.status.toUpperCase()}
              </span>
            )}
          </div>
          <div>
            {inv.hosted_invoice_url && (
              <a
                href={inv.hosted_invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] text-ink-soft hover:text-ink underline underline-offset-2 transition-colors"
              >
                View →
              </a>
            )}
          </div>
        </div>
      ))}
    </>
  )
}

export function BillingSection() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showCheckout, setShowCheckout]         = useState(false)
  const [showUpdateCard, setShowUpdateCard]     = useState(false)
  const [portalLoading, setPortalLoading]       = useState(false)

  const { data: b } = useQuery({
    queryKey:  ['billing-status', user?.id],
    queryFn:   billingApi.getStatus,
    staleTime: 5 * 60 * 1000,
  })

  const isActive  = b?.subscription_status === 'active'
  const isPastDue = b?.subscription_status === 'past_due'
  const isTrial   = b?.is_trial_active && !isActive

  const { data: details } = useQuery({
    queryKey:  ['billing-details', user?.id],
    queryFn:   billingApi.getBillingDetails,
    enabled:   b !== undefined && (isActive || isPastDue),
    staleTime: 5 * 60 * 1000,
  })

  async function openPortal() {
    setPortalLoading(true)
    try {
      const { url } = await billingApi.createPortalSession()
      window.location.href = url
    } catch {
      setPortalLoading(false)
    }
  }

  function handleSubscribeSuccess() {
    setShowCheckout(false)
    queryClient.invalidateQueries({ queryKey: ['billing-status'] })
    queryClient.invalidateQueries({ queryKey: ['billing-details'] })
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

          <div className="mt-6 pt-5 border-t border-dashed border-cream/20 flex items-center justify-between gap-4">
            <p className="font-mono text-[9px] tracking-[0.08em] text-cream/30 uppercase">
              Powered by Stripe
            </p>
            {isActive || isPastDue ? (
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="border border-cream/30 hover:border-cream px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-cream hover:bg-cream/10 disabled:opacity-40 transition-all rounded-full"
              >
                {portalLoading ? 'Loading…' : '＊ Manage billing in Stripe →'}
              </button>
            ) : (
              <button
                onClick={() => setShowCheckout(true)}
                className="bg-orange border border-orange px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-white hover:opacity-80 transition-opacity rounded-full"
              >
                ＊ Subscribe — $700 / mo →
              </button>
            )}
          </div>
        </div>

        {/* ── A · Payment method ─────────────────────────────────────── */}
        <div className="border border-ink bg-paper">
          <div className="flex items-start justify-between px-6 py-5 border-b border-ink">
            <div>
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">A · Payment method</p>
              <h3 className="font-serif text-[22px] leading-none font-medium mt-1">Card on file</h3>
            </div>
            {(isActive || isPastDue) && (
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
                {isActive || isPastDue
                  ? 'Loading card details…'
                  : 'No payment method on file. Subscribe to add one.'}
              </p>
            )}
          </div>
        </div>

        {/* ── B · Invoice history ────────────────────────────────────── */}
        <div className="border border-ink bg-paper">
          <div className="px-6 py-5 border-b border-ink">
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">B · Invoice history</p>
            <h3 className="font-serif text-[22px] leading-none font-medium mt-1">Past invoices</h3>
          </div>
          {details?.invoices && details.invoices.length > 0 ? (
            <InvoiceTable invoices={details.invoices} />
          ) : (
            <div className="px-6 py-8">
              <p className="font-mono text-[11px] text-ink-soft">
                {isActive || isPastDue ? 'Loading invoices…' : 'No invoices yet.'}
              </p>
            </div>
          )}
        </div>

      </div>

      {showCheckout && (
        <CheckoutModal
          onClose={() => setShowCheckout(false)}
          onSuccess={handleSubscribeSuccess}
        />
      )}
      {showUpdateCard && (
        <UpdateCardModal
          onClose={() => setShowUpdateCard(false)}
          onSuccess={handleUpdateCardSuccess}
        />
      )}
    </>
  )
}
