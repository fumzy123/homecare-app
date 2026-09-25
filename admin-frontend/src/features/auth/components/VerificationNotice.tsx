import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { authApi } from '../api'

export function VerificationNotice({ initialEmail = '', onEdit }: { initialEmail?: string; onEdit?: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [remaining, setRemaining] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!remaining) return
    const timer = window.setTimeout(() => setRemaining((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [remaining])

  async function resend(event: React.FormEvent) {
    event.preventDefault()
    if (busy || remaining) return
    setBusy(true)
    setMessage('')
    try {
      await authApi.resendConfirmationEmail(email.trim())
      setRemaining(60)
      setMessage('If this address has a pending signup, a new confirmation link is on its way.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to resend. Please try again.')
    } finally { setBusy(false) }
  }

  return <div className="flex flex-col gap-5 font-mono text-[12px] leading-relaxed">
    <h3 className="text-lg">Check your email</h3>
    <p>Confirm your email address using the link we sent before entering your dashboard. You can open it on another device.</p>
    <p>Check your spam folder too. Already confirmed? Sign in to continue.</p>
    <form onSubmit={resend} className="flex flex-col gap-3">
      <label htmlFor="confirmation-email">Email used to sign up</label>
      <input id="confirmation-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="border border-ink bg-cream p-3" />
      <button disabled={busy || remaining > 0} className="bg-ink text-cream p-3 disabled:opacity-40">
        {busy ? 'Sending…' : remaining ? `Resend in ${remaining}s` : 'Resend confirmation email'}
      </button>
    </form>
    {message && <p role="status">{message}</p>}
    {onEdit && <button onClick={onEdit} className="underline text-left">Wrong address? Correct your signup details</button>}
    <Link to="/login" className="underline">Sign in</Link>
  </div>
}
