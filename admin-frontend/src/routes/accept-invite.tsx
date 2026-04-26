import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { AcceptInviteForm } from '@/features/auth/components/AcceptInviteForm'

export const Route = createFileRoute('/accept-invite')({
  component: AcceptInvitePage,
})

function AcceptInvitePage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setReady(true)
      else if (event === 'SIGNED_OUT') navigate({ to: '/login' })
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream">
        <p className="font-mono text-[11px] text-muted tracking-wide uppercase">Verifying invite…</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-cream">

      {/* ── Left: Editorial panel ── */}
      <div className="flex-1 flex flex-col justify-between px-16 py-14 border-r border-ink">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <rect x="0.5" y="0.5" width="27" height="27" stroke="#111" />
            <path d="M 7 21 L 7 9 L 14 17 L 14 9 L 21 17 L 21 21" stroke="#111" strokeWidth="1.5" fill="none" />
            <circle cx="21" cy="7" r="2.5" fill="#FF5A1F" />
          </svg>
          <div>
            <p className="font-serif text-[18px] leading-none tracking-[-0.02em] font-medium">Homecare</p>
            <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-ink-soft mt-0.5">Home Care OS</p>
          </div>
        </div>

        {/* Headline */}
        <div className="max-w-lg">
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mb-6">
            You've been invited
          </p>
          <h1 className="font-serif text-[52px] leading-[1.0] font-medium tracking-[-0.02em]">
            Welcome to the{' '}
            <span className="tape">team</span>.
          </h1>
          <p className="mt-6 font-mono text-[12px] text-ink-soft leading-relaxed max-w-sm">
            Set a password and enter your name to finish setting up your account.
          </p>
        </div>

        <p className="font-mono text-[9px] text-muted tracking-[0.08em] uppercase">
          Admin Console · {new Date().getFullYear()}
        </p>
      </div>

      {/* ── Right: Form panel ── */}
      <div className="w-[480px] shrink-0 flex flex-col justify-center px-14 py-14 bg-paper border-l border-ink">
        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">Account setup</p>
          <h2 className="font-serif text-[26px] leading-none tracking-[-0.02em] font-medium">Complete your account</h2>
        </div>
        <AcceptInviteForm />
      </div>
    </div>
  )
}
