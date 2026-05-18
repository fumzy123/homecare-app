import { createFileRoute, Link } from '@tanstack/react-router'
import { LegalFooter } from '@/shared/components/LegalFooter'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return (
    <div className="flex h-screen bg-cream">

      {/* ── Left: Editorial panel ── */}
      <div className="flex-1 flex flex-col justify-between px-16 py-14 border-r border-ink max-md:hidden">

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

        <div className="max-w-lg">
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mb-6">
            Account access
          </p>
          <h1 className="font-serif text-[56px] leading-[1.0] font-medium tracking-[-0.02em]">
            Locked out?{' '}
            <span className="italic text-muted">We'll get you back in.</span>
          </h1>
          <p className="mt-6 font-mono text-[12px] text-ink-soft leading-relaxed max-w-sm">
            Enter your email and we'll send a secure link to reset your password.
            The link expires after 60 minutes.
          </p>
        </div>

        <p className="font-mono text-[9px] text-muted tracking-[0.08em] uppercase">
          Admin Console · {new Date().getFullYear()}
        </p>
      </div>

      {/* ── Right: Form panel ── */}
      <div className="w-[480px] max-md:w-full shrink-0 flex flex-col justify-center px-14 max-md:px-8 py-14 bg-paper border-l border-ink">

        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">Password reset</p>
          <h2 className="font-serif text-[26px] leading-none tracking-[-0.02em] font-medium">Reset your password</h2>
        </div>

        <ForgotPasswordForm />

        <LegalFooter />
      </div>
    </div>
  )
}
