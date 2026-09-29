import { useState, useEffect, useRef } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { stripePromise, stripeAppearance } from '@/shared/lib/stripe'
import { BillingDialog } from '@/shared/components/BillingDialog'
import { useAuthStore } from '@/shared/stores/auth'
import { useBillingProfile, useCardSetup } from '../hooks/useBillingProfile'

function CardForm({ onSuccess, setBusy }: { onSuccess: () => void; setBusy: (busy: boolean) => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const user = useAuthStore(s => s.user)
  const { setDefault } = useBillingProfile(user?.id, false)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!stripe || !elements || processing) return
    setProcessing(true); setBusy(true); setError(null)
    try {
      const result = await stripe.confirmSetup({ elements,
        confirmParams: { return_url: `${window.location.origin}/settings/billing` }, redirect: 'if_required' })
      if (result.error) throw new Error(result.error.message ?? 'Could not verify your card.')
      if (result.setupIntent?.status !== 'succeeded' || typeof result.setupIntent.payment_method !== 'string') throw new Error('Card verification is not complete. Please try again.')
      await setDefault.mutateAsync(result.setupIntent.payment_method)
      onSuccess()
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your card. Please try again.') }
    finally { setProcessing(false); setBusy(false) }
  }
  return <form onSubmit={submit} className="space-y-5"><PaymentElement />
    <p className="text-sm text-ink-soft">Save this card as your default for future payments.</p>
    {error && <p role="alert" className="text-sm text-orange">{error}</p>}
    <button disabled={!stripe || !elements || processing} className="w-full bg-ink px-5 py-3 text-paper disabled:opacity-40">{processing ? 'Saving…' : 'Save payment method'}</button>
  </form>
}

export function UpdateCardModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const setup = useCardSetup()
  const started = useRef(false)
  const start = setup.mutate
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!started.current) { started.current = true; start() } }, [start])
  return <BillingDialog title="Add payment method" busy={busy} onClose={onClose}>
    {setup.isPending && <p role="status">Loading secure payment form…</p>}
    {setup.isError && <p role="alert">Could not load the form. <button className="underline" onClick={() => setup.mutate()}>Try again</button></p>}
    {setup.data && <Elements stripe={stripePromise} options={{ clientSecret: setup.data.client_secret, appearance: stripeAppearance }}>
      <CardForm onSuccess={onSuccess} setBusy={setBusy} />
    </Elements>}
  </BillingDialog>
}
