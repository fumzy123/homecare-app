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

function LoginPage() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">

      {/* Decorative crosses */}
      <div className="absolute top-16 right-24 text-ink-soft opacity-30">
        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1"/><line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1"/></svg>
      </div>
      <div className="absolute bottom-24 left-20 text-ink-soft opacity-20">
        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1"/><line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1"/></svg>
      </div>

      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="0.5" y="0.5" width="27" height="27" stroke="#111" />
            <path d="M 7 21 L 7 9 L 14 17 L 14 9 L 21 17 L 21 21" stroke="#111" strokeWidth="1.5" fill="none" />
            <circle cx="21" cy="7" r="2.5" fill="#FF5A1F" />
          </svg>
          <div>
            <p className="font-serif text-[20px] leading-none tracking-[-0.02em] font-medium">Homecare</p>
            <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-ink-soft mt-0.5">Home Care OS</p>
          </div>
        </div>

        {/* Card */}
        <div className="border border-ink bg-paper">
          <div className="px-8 py-6 border-b border-ink">
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2">Admin Console</p>
            <h1 className="font-serif text-[28px] leading-none tracking-[-0.02em] font-medium">Sign in</h1>
          </div>
          <div className="px-8 py-6">
            <LoginForm />
          </div>
        </div>

        <p className="mt-5 text-center font-mono text-[10px] text-ink-soft">
          New agency?{' '}
          <Link to="/register" className="text-ink underline underline-offset-2 hover:text-orange transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
