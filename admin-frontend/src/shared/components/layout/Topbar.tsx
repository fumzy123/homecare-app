import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { useAuthStore } from '@/shared/stores/auth'
import { authApi } from '@/features/auth/api'
import { Pill, Avatar } from '@/shared/components/ui'

const NAV = [
  { to: '/dashboard',            num: '01', label: 'Dashboard' },
  { to: '/dashboard/workers',    num: '02', label: 'Workers' },
  { to: '/dashboard/clients',    num: '03', label: 'Clients' },
  { to: '/dashboard/shifts',     num: '04', label: 'Schedule' },
  { to: '/dashboard/timesheet',  num: '05', label: 'Timesheets' },
]

const now      = new Date()
const weekNum  = Math.ceil((now.getDate() - now.getDay() + 1) / 7) + Math.ceil(new Date(now.getFullYear(), 0, 1).getDay() / 7)
const wkStart  = format(startOfWeek(now, { weekStartsOn: 1 }), 'MMM d')
const wkEnd    = format(endOfWeek(now,   { weekStartsOn: 1 }), 'MMM d')
const wkYear   = format(now, 'yyyy')

export function Topbar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?'

  function isActive(to: string) {
    if (to === '/dashboard') return currentPath === '/dashboard' || currentPath === '/dashboard/'
    return currentPath.startsWith(to)
  }

  async function handleSignOut() {
    await authApi.signOut()
    clearAuth()
    navigate({ to: '/login' })
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <header className="border-b border-ink bg-cream sticky top-0 z-20">
      {/* Agency info strip */}
      <div className="flex items-center justify-between px-6 py-1.5 border-b border-line-faint">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft">
          HMCR-2026 · ADMIN CONSOLE
        </span>
        <div className="flex items-center gap-6 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft">
          <span>WK {weekNum} · {wkStart}–{wkEnd} · {wkYear}</span>
          <span className="flex items-center gap-1.5">
            <span className="dot dot-mint" />
            System OK
          </span>
        </div>
      </div>

      {/* Main nav row */}
      <div className="flex items-center justify-between px-6 py-3 gap-6">
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="0.5" y="0.5" width="27" height="27" stroke="#111" />
              <path d="M 7 21 L 7 9 L 14 17 L 14 9 L 21 17 L 21 21" stroke="#111" strokeWidth="1.5" fill="none" />
              <circle cx="21" cy="7" r="2.5" fill="#FF5A1F" />
            </svg>
            <span className="font-serif text-[22px] leading-none tracking-[-0.02em] font-medium">Homecare</span>
          </div>
          <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-soft">HOME CARE OS</span>
        </Link>

        {/* Nav pills */}
        <nav className="flex items-center gap-1">
          {NAV.map(({ to, num, label }) => (
            <Link key={to} to={to}>
              <Pill variant={isActive(to) ? 'default' : 'ghost'} active={isActive(to)}>
                <span className="opacity-50 mr-0.5">{num}</span>
                {label}
              </Pill>
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <Avatar initials={initials} color="c1" size="md" />
            <div className="text-left">
              <p className="text-[12px] font-medium leading-tight">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft">Admin</p>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-paper border border-ink shadow-none z-50">
              <Link
                to="/account"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-ink hover:bg-cream-2 transition-colors border-b border-line-faint"
              >
                Account Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-ink hover:bg-cream-2 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
