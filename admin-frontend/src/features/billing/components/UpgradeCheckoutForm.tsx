import { useState, useEffect } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { billingApi } from '@/features/billing/api'
import { stripePromise, stripeAppearance } from '@/shared/lib/stripe'

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe   = useStripe()
  const elements = useElements()
  const [error, setError]           = useState<string | null>(null)
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
        <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-ink text-cream py-3.5 font-mono text-[11px] tracking-[0.1em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
      >
        {processing ? 'Processing…' : 'Subscribe — $700 / mo'}
      </button>

      <p className="font-mono text-[9px] text-muted text-center tracking-[0.06em]">
        By subscribing you agree to be charged $700.00 USD monthly until cancelled.
      </p>
    </form>
  )
}

interface UpgradeCheckoutFormProps {
  onSuccess: () => void
}

export function UpgradeCheckoutForm({ onSuccess }: UpgradeCheckoutFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadError, setLoadError]       = useState<string | null>(null)

  useEffect(() => {
    billingApi.createSubscriptionIntent()
      .then(({ client_secret }) => setClientSecret(client_secret))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setLoadError(msg || 'Could not initialize payment. Please try again.')
      })
  }, [])

  if (loadError) {
    return (
      <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">
        {loadError}
      </p>
    )
  }

  if (!clientSecret) {
    return (
      <p className="font-mono text-[10px] text-muted py-10 text-center tracking-wide">
        Initializing…
      </p>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: stripeAppearance }}
    >
      <PaymentForm onSuccess={onSuccess} />
    </Elements>
  )
}
