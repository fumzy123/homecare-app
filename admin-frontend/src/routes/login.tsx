import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { LoginForm } from '@/features/auth/components/LoginForm'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    const token = useAuthStore.getState().accessToken
    if (token) throw redirect({ to: '/dashboard' })
  },
  component: LoginPage,
})

// ── Mini schedule preview ─────────────────────────────────────────────────────

const PREVIEW_SHIFTS = [
  { initials: 'SU', label: 'Seyi U.',   client: 'Danny Smith',    start: 0.18, width: 0.55, bg: '#9DE8DC', border: '#111', solid: true  },
  { initials: 'AN', label: 'Aisha N.',  client: 'Eleanor Vance',  start: 0.00, width: 0.36, bg: '#111111', border: '#111', solid: true  },
  { initials: 'JB', label: 'Jordan B.', client: 'Russell Bauer',  start: 0.27, width: 0.27, bg: '#FFE2D4', border: '#111', solid: false },
  { initials: 'DO', label: 'Diego O.',  client: 'Constance Reyes',start: 0.64, width: 0.36, bg: '#F4D35E', border: '#111', solid: true  },
]

const AVATAR_BG = ['#FF5A1F', '#9DE8DC', '#F4D35E', '#EDE8DC']
const AVATAR_COLOR = ['#fff', '#111', '#111', '#111']

function SchedulePreview() {
  return (
    <div className="mt-10 animate-fade-up" style={{ animationDelay: '0.4s' }}>
      {/* Hour ruler */}
      <div className="flex mb-2" style={{ paddingLeft: 96 }}>
        {['9', '11', '13', '15', '17'].map((h) => (
          <div key={h} className="flex-1 font-mono text-[9px] text-cream/40 text-center">{h}:00</div>
        ))}
      </div>

      {/* Worker rows */}
      <div className="space-y-2">
        {PREVIEW_SHIFTS.map((shift, i) => (
          <div
            key={i}
            className="flex items-center gap-3 animate-slide-in"
            style={{ animationDelay: `${0.5 + i * 0.12}s` }}
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-mono text-[9px] font-bold shrink-0"
              style={{ background: AVATAR_BG[i], color: AVATAR_COLOR[i] }}
            >
              {shift.initials}
            </div>

            {/* Name */}
            <div className="shrink-0" style={{ width: 56 }}>
              <p className="font-mono text-[9px] text-cream/70 leading-none truncate">{shift.label}</p>
            </div>

            {/* Track */}
            <div className="relative flex-1 h-7" style={{ background: 'rgba(242,238,229,0.06)' }}>
              {/* Shift block */}
              <div
                className="absolute top-0.5 bottom-0.5 flex items-center overflow-hidden"
                style={{
                  left:   `calc(${shift.start * 100}% + 1px)`,
                  width:  `calc(${shift.width * 100}% - 2px)`,
                  background: shift.bg,
                  border: `1px ${shift.solid ? 'solid' : 'dashed'} ${shift.border}`,
                }}
              >
                <span className="px-1.5 font-mono text-[8px] truncate" style={{ color: shift.bg === '#111111' ? '#F2EEE5' : '#111' }}>
                  {shift.client}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* NOW line decoration */}
      <div className="relative mt-1" style={{ paddingLeft: 96 + 56 + 12 }}>
        <div className="h-px bg-orange/50 relative">
          <span className="absolute -top-2.5 left-0 font-mono text-[8px] text-orange/70 bg-ink px-1">NOW</span>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function LoginPage() {
  return (
    <div className="flex h-screen">

      {/* ── Left: Marketing panel ── */}
      <div className="flex-1 bg-ink flex flex-col justify-between px-16 py-14 overflow-hidden relative">

        {/* Decorative dots */}
        <div className="absolute top-10 right-10 opacity-10">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="0" x2="6" y2="12" stroke="#F2EEE5" strokeWidth="1"/><line x1="0" y1="6" x2="12" y2="6" stroke="#F2EEE5" strokeWidth="1"/></svg>
        </div>
        <div className="absolute bottom-20 left-12 opacity-10">
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

        {/* Headline */}
        <div>
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-orange mb-4 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            For home care agencies
          </p>

          <h1
            className="font-serif text-[52px] leading-[1.0] font-medium tracking-[-0.02em] text-cream max-w-lg animate-fade-up"
            style={{ animationDelay: '0.25s' }}
          >
            Stop fighting Excel.<br />
            Start <span className="tape">caring</span>.
          </h1>

          <div className="mt-8 space-y-3 animate-fade-up" style={{ animationDelay: '0.35s' }}>
            {[
              'Schedule recurring shifts in seconds',
              'Worker hours tracked automatically',
              'Every client, every shift — one view',
            ].map((point) => (
              <p key={point} className="flex items-center gap-3 font-mono text-[11px] text-cream/60">
                <span className="w-1.5 h-1.5 rounded-full bg-mint shrink-0" />
                {point}
              </p>
            ))}
          </div>

          {/* Schedule preview */}
          <SchedulePreview />
        </div>

        {/* Footer */}
        <p className="font-mono text-[9px] text-cream/30 tracking-[0.08em] animate-fade-up" style={{ animationDelay: '0.5s' }}>
          HOMECARE OS · ADMIN CONSOLE
        </p>
      </div>

      {/* ── Right: Form panel ── */}
      <div className="w-[440px] shrink-0 bg-cream border-l border-ink flex flex-col justify-center px-14 py-14">

        <div className="mb-8">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">Admin Console</p>
          <h2 className="font-serif text-[28px] leading-none tracking-[-0.02em] font-medium">Sign in</h2>
        </div>

        <LoginForm />

        <p className="mt-8 font-mono text-[10px] text-ink-soft">
          New agency?{' '}
          <Link to="/register" className="text-ink underline underline-offset-2 hover:text-orange transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
