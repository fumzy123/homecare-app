import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'

export const Route = createFileRoute('/welcome')({
  component: WelcomePage,
})

function WelcomePage() {
  const [orgName, setOrgName] = useState<string>('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const name = session?.user?.user_metadata?.org_name ?? ''
      setOrgName(name)
    })
  }, [])

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
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-mint mb-6">
            ✓ Account created
          </p>
          <h1 className="font-serif text-[56px] leading-[1.0] font-medium tracking-[-0.02em]">
            You're{' '}
            <span className="tape">all set</span>.
          </h1>
          <p className="mt-6 font-mono text-[12px] text-ink-soft leading-relaxed max-w-sm">
            {orgName
              ? <>Welcome to <span className="text-ink">{orgName}</span>. Your account is ready.</>
              : 'Your account is ready to go.'
            }
          </p>
        </div>

        <p className="font-mono text-[9px] text-muted tracking-[0.08em] uppercase">
          Admin Console · {new Date().getFullYear()}
        </p>
      </div>

      {/* ── Right: Confirmation panel ── */}
      <div className="w-[480px] shrink-0 flex flex-col justify-center px-14 py-14 bg-paper border-l border-ink">

        <div className="border border-ink bg-cream p-6 mb-8">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-3">What's next</p>
          <div className="space-y-4">
            {[
              { num: '01', text: 'Download the Homecare Worker app when it becomes available on iOS and Android.' },
              { num: '02', text: 'You\'ll receive an email notification once the mobile app is ready for download.' },
              { num: '03', text: 'Your agency admin can assign you shifts in the meantime.' },
            ].map(({ num, text }) => (
              <div key={num} className="flex gap-4">
                <span className="font-mono text-[10px] text-muted shrink-0 mt-px">{num}</span>
                <p className="font-mono text-[11px] text-ink-soft leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <Link
          to="/login"
          className="w-full bg-ink text-cream py-3 font-mono text-[11px] tracking-[0.1em] uppercase hover:opacity-80 transition-opacity text-center block"
        >
          Go to sign in →
        </Link>
      </div>
    </div>
  )
}
