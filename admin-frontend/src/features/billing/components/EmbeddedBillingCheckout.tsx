import { useState } from 'react'
import { EmbeddedCheckoutProvider, EmbeddedCheckout, Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { stripePromise, stripeAppearance } from '@/shared/lib/stripe'
import { BillingDialog } from '@/shared/components/BillingDialog'

function PayInvoice({ onComplete, setProcessing }: { onComplete: () => void; setProcessing: (value: boolean) => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault()
    if (!stripe || !elements || busy) return
    setBusy(true); setProcessing(true); setError('')
    try {
      const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/settings/billing?card_setup=complete` }, redirect: 'if_required' })
      if (result.error) setError(result.error.message ?? 'Payment could not be completed.')
      else onComplete()
    } catch { setError('Could not complete payment. Please try again.') }
    finally { setBusy(false); setProcessing(false) }
  }}><PaymentElement />{error && <p role="alert" className="text-orange">{error}</p>}<button disabled={busy || !stripe || !elements} className="bg-ink px-5 py-3 text-paper disabled:opacity-40">{busy ? 'Processing…' : 'Pay and subscribe'}</button></form>
}

export function EmbeddedBillingCheckout({ clientSecret, paymentSecret, onComplete, onClose }: {
  clientSecret?: string; paymentSecret?: string; onComplete: () => void; onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  return <BillingDialog title={paymentSecret ? 'Complete payment' : 'Payment details'} busy={busy} onClose={onClose}>
    {paymentSecret ? <Elements stripe={stripePromise} options={{ clientSecret: paymentSecret, appearance: stripeAppearance }}><PayInvoice onComplete={onComplete} setProcessing={setBusy} /></Elements>
      : clientSecret ? <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret, onComplete }}><EmbeddedCheckout /></EmbeddedCheckoutProvider> : <p role="status">Confirming your subscription…</p>}
  </BillingDialog>
}
