import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { supabase } from '@/shared/lib/supabase'
import { authApi } from '@/features/auth/api'
import { useAuthStore } from '@/shared/stores/auth'
import { legalApi, CURRENT_TERMS_VERSION } from '@/shared/lib/legal'

const STORAGE_KEY = 'pending_registration'

interface PendingRegistration {
  org_name:   string
  first_name: string
  last_name:  string
  email:      string
}

export function ConfirmEmailForm() {
  const navigate    = useNavigate()
  const completing  = useRef(false)
  const [error, setError] = useState<string | null>(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    return hash.get('error')
      ? (hash.get('error_description') ?? 'Confirmation link is invalid or has expired.')
      : null
  })

  useEffect(() => {
    if (error) return

    const complete = async () => {
      if (completing.current) return
      completing.current = true
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setError('wrong-browser')
        return
      }
      const pending: PendingRegistration = JSON.parse(raw)
      try {
        await authApi.registerOrganization({
          organization_name: pending.org_name,
          first_name:        pending.first_name,
          last_name:         pending.last_name,
        })
        // Refresh the session so the new JWT embeds the role the backend just
        // wrote into user_metadata. Without this, the stored token has no role
        // and any future auth state event (tab focus, auto-refresh) overwrites
        // Zustand back to role='' and triggers the worker-access screen.
        await supabase.auth.refreshSession()
        await legalApi.acceptTerms(CURRENT_TERMS_VERSION)
        useAuthStore.getState().setTermsAccepted(CURRENT_TERMS_VERSION)
        localStorage.removeItem(STORAGE_KEY)
        navigate({ to: '/dashboard' })
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please contact support.')
      }
    }

    // Handle the case where the session already exists (same-browser, token processed instantly)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { complete(); return }
    })

    // Handle the SIGNED_IN event fired when Supabase processes the confirmation token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) complete()
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  if (error === 'wrong-browser') {
    return (
      <div className="flex flex-col gap-5">
        <div className="border-l-2 border-orange px-4 py-3 bg-cream-2">
          <p className="font-mono text-[10px] text-ink leading-relaxed">
            This link was opened on a different browser or device than where you registered.
            Please open it on the same browser, or start registration again.
          </p>
        </div>
        <Link
          to="/register"
          className="font-mono text-[10px] text-ink underline underline-offset-2 hover:text-orange transition-colors"
        >
          ← Start over
        </Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-5">
        <div className="border-l-2 border-orange px-4 py-3 bg-cream-2">
          <p className="font-mono text-[10px] text-ink leading-relaxed">{error}</p>
        </div>
        <Link
          to="/register"
          className="font-mono text-[10px] text-ink underline underline-offset-2 hover:text-orange transition-colors"
        >
          ← Back to registration
        </Link>
      </div>
    )
  }

  return (
    <p className="font-mono text-[11px] text-muted tracking-wide uppercase">
      Setting up your account…
    </p>
  )
}
