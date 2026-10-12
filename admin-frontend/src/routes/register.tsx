import { BoatLogo } from '@/shared/components/ui/BoatLogo'
import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { LegalFooter } from '@/shared/components/LegalFooter'

export const Route = createFileRoute('/register')({
  beforeLoad: () => {
    const token = useAuthStore.getState().accessToken
    if (token) throw redirect({ to: '/dashboard' })
  },
  component: RegisterPage,
})

function RegisterPage() {
  return (
    <div className="flex min-h-screen bg-cream">

      {/* ── Left: Editorial panel ── */}
      <div className="flex-1 flex flex-col justify-between px-16 py-14 border-r border-ink max-md:hidden">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <BoatLogo size={26} />
          <div>
            <p className="font-serif text-[18px] leading-none tracking-[-0.02em] font-medium">Care Harbor</p>
          </div>
        </div>

        {/* Headline */}
        <div className="max-w-lg">
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mb-6">
            Personal onboarding included
          </p>
          <h1 className="font-serif text-[56px] leading-[1.0] font-medium tracking-[-0.02em]">
            Your agency,{' '}
            <span className="tape">organized</span>{' '}
            from day one.
          </h1>
          <p className="mt-6 font-mono text-[12px] text-ink-soft leading-relaxed max-w-sm">
            Create your agency account to start your 14-day free trial. Choose a paid plan whenever you are ready.
          </p>
        </div>

        {/* Footer */}
        <p className="font-mono text-[9px] text-muted tracking-[0.08em] uppercase">
          Admin Console · {new Date().getFullYear()}
        </p>
      </div>

      {/* ── Right: Form panel ── */}
      <div className="w-[480px] max-md:w-full shrink-0 flex flex-col justify-center px-14 max-md:px-8 py-14 bg-paper border-l border-ink overflow-y-auto">

        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">New Agency</p>
          <h2 className="font-serif text-[26px] leading-none tracking-[-0.02em] font-medium">Create account</h2>
        </div>

        <RegisterForm />

        <p className="mt-5 text-sm text-ink-soft leading-relaxed">
          Your trial starts when your agency account is created after email confirmation. Subscribe at any time to keep your remaining trial days. Your chosen plan is charged when the trial ends unless you cancel renewal.
        </p>

        <p className="mt-8 font-mono text-[10px] text-ink-soft">
          Already have an account?{' '}
          <Link to="/login" className="text-ink underline underline-offset-2 hover:text-orange transition-colors">
            Sign in
          </Link>
        </p>

        <LegalFooter />
      </div>
    </div>
  )
}
