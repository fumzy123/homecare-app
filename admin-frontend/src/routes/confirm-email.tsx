import { BoatLogo } from '@/shared/components/ui/BoatLogo'
import { createFileRoute } from '@tanstack/react-router'
import { LegalFooter } from '@/shared/components/LegalFooter'
import { ConfirmEmailForm } from '@/features/auth/components/ConfirmEmailForm'

export const Route = createFileRoute('/confirm-email')({
  component: ConfirmEmailPage,
})

function ConfirmEmailPage() {
  return (
    <div className="flex min-h-screen bg-cream">

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
            Almost there
          </p>
          <h1 className="font-serif text-[56px] leading-[1.0] font-medium tracking-[-0.02em]">
            Confirming your{' '}
            <span className="italic text-muted">email address.</span>
          </h1>
          <p className="mt-6 font-mono text-[12px] text-ink-soft leading-relaxed max-w-sm">
            Verify your email, then confirm your agency details to finish setting up your account.
          </p>
        </div>

        <p className="font-mono text-[9px] text-muted tracking-[0.08em] uppercase">
          Admin Console · {new Date().getFullYear()}
        </p>
      </div>

      {/* ── Right: Status panel ── */}
      <div className="w-[480px] max-md:w-full shrink-0 flex flex-col justify-center px-14 max-md:px-8 py-14 bg-paper border-l border-ink">

        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">Email confirmation</p>
          <h2 className="font-serif text-[26px] leading-none tracking-[-0.02em] font-medium">Finishing setup</h2>
        </div>

        <ConfirmEmailForm />

        <LegalFooter />
      </div>
    </div>
  )
}
