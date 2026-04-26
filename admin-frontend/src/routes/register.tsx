import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { RegisterForm } from '@/features/auth/components/RegisterForm'

export const Route = createFileRoute('/register')({
  beforeLoad: () => {
    const token = useAuthStore.getState().accessToken
    if (token) throw redirect({ to: '/dashboard' })
  },
  component: RegisterPage,
})

const FEATURES = [
  { label: 'Shift scheduling',   sub: 'Recurring shifts, worker assignment, auto-completion' },
  { label: 'Worker management',  sub: 'Hours tracking, availability, utilization reporting'  },
  { label: 'Client records',     sub: 'Medical conditions, care notes, emergency contacts'   },
  { label: 'Timesheets',         sub: 'Billable hours, status tracking, period summaries'    },
]

function RegisterPage() {
  return (
    <div className="flex min-h-screen">

      {/* ── Left: Marketing panel ── */}
      <div className="flex-1 bg-ink flex flex-col justify-between px-16 py-14 overflow-hidden relative">

        {/* Decorative */}
        <div className="absolute top-10 right-10 opacity-10">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="0" x2="6" y2="12" stroke="#F2EEE5" strokeWidth="1"/><line x1="0" y1="6" x2="12" y2="6" stroke="#F2EEE5" strokeWidth="1"/></svg>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-3 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <rect x="0.5" y="0.5" width="27" height="27" stroke="#F2EEE5" />
            <path d="M 7 21 L 7 9 L 14 17 L 14 9 L 21 17 L 21 21" stroke="#F2EEE5" strokeWidth="1.5" fill="none" />
            <circle cx="21" cy="7" r="2.5" fill="#FF5A1F" />
          </svg>
          <div>
            <p className="font-serif text-[18px] leading-none tracking-[-0.02em] font-medium text-cream">Homecare</p>
            <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-cream/50 mt-0.5">Home Care OS</p>
          </div>
        </div>

        {/* Headline + features */}
        <div>
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-orange mb-4 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Get started free
          </p>

          <h1
            className="font-serif text-[48px] leading-[1.0] font-medium tracking-[-0.02em] text-cream max-w-lg animate-fade-up"
            style={{ animationDelay: '0.25s' }}
          >
            Everything your agency needs —{' '}
            <span className="tape-orange">in one place</span>.
          </h1>

          <p
            className="mt-5 font-mono text-[11px] text-cream/50 max-w-sm leading-relaxed animate-fade-up"
            style={{ animationDelay: '0.3s' }}
          >
            Set up your agency in minutes. No credit card. No spreadsheets. No chaos.
          </p>

          {/* Feature cards */}
          <div className="mt-10 grid grid-cols-2 gap-3 animate-fade-up" style={{ animationDelay: '0.4s' }}>
            {FEATURES.map((f, i) => (
              <div
                key={f.label}
                className="border border-cream/10 px-4 py-3 animate-slide-in"
                style={{ animationDelay: `${0.45 + i * 0.08}s` }}
              >
                <p className="font-mono text-[10px] tracking-[0.05em] text-cream/90 mb-1">{f.label}</p>
                <p className="font-mono text-[9px] text-cream/40 leading-snug">{f.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="font-mono text-[9px] text-cream/30 tracking-[0.08em] animate-fade-up" style={{ animationDelay: '0.6s' }}>
          HOMECARE OS · ADMIN CONSOLE
        </p>
      </div>

      {/* ── Right: Form panel ── */}
      <div className="w-[480px] shrink-0 bg-cream border-l border-ink flex flex-col justify-center px-14 py-14 overflow-y-auto">

        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">New Agency</p>
          <h2 className="font-serif text-[28px] leading-none tracking-[-0.02em] font-medium">Create account</h2>
        </div>

        <RegisterForm />

        <p className="mt-8 font-mono text-[10px] text-ink-soft">
          Already have an account?{' '}
          <Link to="/login" className="text-ink underline underline-offset-2 hover:text-orange transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
