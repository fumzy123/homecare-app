import { BoatLogo } from '@/shared/components/ui/BoatLogo'
import { createFileRoute } from '@tanstack/react-router'
import { LegalFooter } from '@/shared/components/LegalFooter'
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  return (
    <div className="flex h-screen bg-cream">

      {/* ── Left: Editorial panel ── */}
      <div className="flex-1 flex flex-col justify-between px-16 py-14 border-r border-ink max-md:hidden">

        <div className="flex items-center gap-3">
          <BoatLogo size={26} />
          <div>
            <p className="font-serif text-[18px] leading-none tracking-[-0.02em] font-medium">Care Harbor</p>
          </div>
        </div>

        <div className="max-w-lg">
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mb-6">
            Account access
          </p>
          <h1 className="font-serif text-[56px] leading-[1.0] font-medium tracking-[-0.02em]">
            Almost there.{' '}
            <span className="italic text-muted">Choose a new password.</span>
          </h1>
          <p className="mt-6 font-mono text-[12px] text-ink-soft leading-relaxed max-w-sm">
            Your identity has been verified. Pick a strong password — at least 8 characters.
          </p>
        </div>

        <p className="font-mono text-[9px] text-muted tracking-[0.08em] uppercase">
          Admin Console · {new Date().getFullYear()}
        </p>
      </div>

      {/* ── Right: Form panel ── */}
      <div className="w-[480px] max-md:w-full shrink-0 flex flex-col justify-center px-14 max-md:px-8 py-14 bg-paper border-l border-ink">

        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">New password</p>
          <h2 className="font-serif text-[26px] leading-none tracking-[-0.02em] font-medium">Choose a new password</h2>
        </div>

        <ResetPasswordForm />

        <LegalFooter />
      </div>
    </div>
  )
}
