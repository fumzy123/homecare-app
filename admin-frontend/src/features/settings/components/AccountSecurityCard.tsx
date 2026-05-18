import { useState } from 'react'
import { useAuthStore } from '@/shared/stores/auth'
import { authApi } from '@/features/auth/api'

export function AccountSecurityCard() {
  const { user }  = useAuthStore()
  const [sending,   setSending]   = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const handleSendReset = async () => {
    if (!user?.email) return
    setSending(true)
    setError(null)
    try {
      await authApi.sendPasswordResetEmail(user.email)
      setEmailSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border border-ink bg-paper">
      <div className="px-6 py-4 border-b border-ink">
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">B · Account security</p>
        <h3 className="font-serif text-[22px] leading-none font-medium mt-1">Password &amp; authentication</h3>
      </div>

      <div className="px-6 py-6 space-y-5">
        <p className="font-mono text-[12px] text-ink leading-relaxed">
          Authentication is handled by{' '}
          <span className="bg-cream-2 border border-line-soft px-1.5 py-0.5 font-mono text-[11px]">
            Supabase Auth
          </span>
          . We'll email a one-time reset link to <strong>{user?.email}</strong>.
          The link is valid for 60 minutes.
        </p>

        {emailSent ? (
          <div className="border-l-2 border-mint px-4 py-3 bg-cream-2">
            <p className="font-mono text-[10px] text-ink">Reset link sent — check your inbox.</p>
          </div>
        ) : (
          <>
            {error && (
              <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{error}</p>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleSendReset}
                disabled={sending}
                className="border border-ink bg-paper text-ink font-mono text-[10px] tracking-[0.06em] uppercase px-5 py-2.5 rounded-full hover:bg-cream-2 disabled:opacity-40 transition-colors"
              >
                {sending ? 'Sending…' : '＊  Send password reset email'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
