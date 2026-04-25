import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/shared/stores/auth'
import { authApi } from '@/features/auth/api'
import { Avatar } from '@/shared/components/ui'

const NAV = [
  { to: '/dashboard',           num: '01', label: 'Dashboard'  },
  { to: '/dashboard/workers',   num: '02', label: 'Workers'    },
  { to: '/dashboard/clients',   num: '03', label: 'Clients'    },
  { to: '/dashboard/shifts',    num: '04', label: 'Schedule'   },
  { to: '/dashboard/timesheet', num: '05', label: 'Timesheets' },
]

export function Sidebar() {
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
    <aside className="flex h-screen w-52 flex-col border-r border-ink bg-cream shrink-0">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-ink">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <rect x="0.5" y="0.5" width="27" height="27" stroke="#111" />
            <path d="M 7 21 L 7 9 L 14 17 L 14 9 L 21 17 L 21 21" stroke="#111" strokeWidth="1.5" fill="none" />
            <circle cx="21" cy="7" r="2.5" fill="#FF5A1F" />
          </svg>
          <div>
            <p className="font-serif text-[18px] leading-none tracking-[-0.02em] font-medium">Homecare</p>
            <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-ink-soft mt-0.5">HOME CARE OS</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {NAV.map(({ to, num, label }) => (
          <Link key={to} to={to}>
            <div className={`flex items-center justify-between px-4 py-2.5 font-mono text-[11px] tracking-[0.03em] transition-colors border border-transparent ${
              isActive(to)
                ? 'bg-ink text-cream border-ink'
                : 'text-ink-soft hover:text-ink hover:bg-cream-2'
            }`}>
              <span>{label}</span>
              <span className={`text-[9px] ${isActive(to) ? 'opacity-50' : 'opacity-40'}`}>{num}</span>
            </div>
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-ink" ref={menuRef}>
        {menuOpen && (
          <div className="border-b border-ink bg-paper">
            <Link
              to="/account"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-3 font-mono text-[11px] text-ink-soft hover:text-ink hover:bg-cream-2 transition-colors border-b border-line-faint"
            >
              Account settings
            </Link>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-4 py-3 font-mono text-[11px] text-ink-soft hover:text-ink hover:bg-cream-2 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}

        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex w-full items-center gap-3 px-4 py-3.5 hover:bg-cream-2 transition-colors"
        >
          <Avatar initials={initials} color="c1" size="sm" />
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[12px] font-medium leading-snug truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-ink-soft">Admin</p>
          </div>
        </button>
      </div>
    </aside>
  )
}
