import { useState, useEffect } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { billingApi } from '@/features/billing/api'
import { stripePromise, stripeAppearance } from '@/shared/lib/stripe'

function CheckoutForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const stripe   = useStripe()
  const elements = useElements()
  const [error, setError]         = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setProcessing(true)
    setError(null)

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
      setProcessing(false)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <PaymentElement />

      {error && (
        <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors px-4 py-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || processing}
          className="bg-ink text-cream px-6 py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          {processing ? 'Processing…' : 'Subscribe — $700 / mo'}
        </button>
      </div>
    </form>
  )
}

interface CheckoutModalProps {
  onClose:   () => void
  onSuccess: () => void
}

export function CheckoutModal({ onClose, onSuccess }: CheckoutModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadError, setLoadError]       = useState<string | null>(null)

  useEffect(() => {
    billingApi.createSubscriptionIntent()
      .then(({ client_secret }) => setClientSecret(client_secret))
      .catch(() => setLoadError('Could not initialize payment. Please try again.'))
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="bg-paper border border-ink w-full max-w-lg">

        {/* Header */}
        <div className="flex items-start justify-between px-7 py-5 border-b border-ink">
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-1">
              New subscription
            </p>
            <h2 className="font-serif text-[24px] leading-none font-medium">
              Subscribe to <span className="italic">Homecare OS</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-soft hover:text-ink transition-colors mt-0.5 font-mono text-[18px] leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6">
          {loadError && (
            <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2 mb-4">
              {loadError}
            </p>
          )}
          {!clientSecret && !loadError && (
            <p className="font-mono text-[10px] text-muted text-center py-10 tracking-wide">
              Initializing…
            </p>
          )}
          {clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: stripeAppearance }}
            >
              <CheckoutForm onSuccess={onSuccess} onClose={onClose} />
            </Elements>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-3 border-t border-line-faint">
          <p className="font-mono text-[9px] text-muted tracking-[0.06em] uppercase">
            Secured by Stripe · $700.00 USD / month · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  )
}
