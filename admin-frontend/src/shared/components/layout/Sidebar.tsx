import { BoatLogo } from '@/shared/components/ui/BoatLogo'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { X, Settings, LogOut, LayoutGrid, UsersRound, HeartHandshake, CalendarDays, Clock3, ClipboardList, CheckCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/stores/auth'
import { authApi } from '@/features/auth/api'
import { Avatar } from '@/shared/components/ui'

const NAV = [
  { to: '/dashboard',            icon: LayoutGrid,     label: 'Dashboard'  },
  { to: '/dashboard/activity', icon: CheckCheck, label: 'Activity' },
  { to: '/dashboard/workers',    icon: UsersRound,     label: 'Workers'    },
  { to: '/dashboard/clients',    icon: HeartHandshake, label: 'Clients'    },
  { to: '/dashboard/shifts',     icon: CalendarDays,   label: 'Schedule'   },
  { to: '/dashboard/timesheet',  icon: Clock3,         label: 'Timesheets' },
  { to: '/dashboard/placements', icon: ClipboardList,  label: 'Placements' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?'

  function isActive(to: string) {
    if (to === '/dashboard') return currentPath === '/dashboard' || currentPath === '/dashboard/'
    return currentPath.startsWith(to)
  }

  async function handleSignOut() {
    await authApi.signOut()
    queryClient.clear()
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
    <aside className={`
      max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50
      flex h-screen w-52 flex-col border-r border-ink bg-cream shrink-0
      transition-transform duration-200 ease-in-out
      ${open ? '' : 'max-lg:-translate-x-full'}
    `}>

      {/* Logo */}
      <div className="px-5 py-5 border-b border-ink flex items-center justify-between">
        <Link to="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
          <BoatLogo size={24} />
          <div>
            <p className="font-serif text-[18px] leading-none tracking-[-0.02em] font-medium">Care Harbor</p>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="hidden max-lg:block p-1 text-ink-soft hover:text-ink transition-colors"
          aria-label="Close menu"
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-[12px] py-2">
        {NAV.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} onClick={onClose} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            <div className={`flex items-center gap-2.5 px-3 py-2.5 font-mono text-[11px] tracking-[0.03em] transition-colors border border-transparent ${
              isActive(to)
                ? 'bg-ink text-cream border-ink'
                : 'text-ink-soft hover:text-ink hover:bg-cream-2'
            }`}>
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
              <span>{label}</span>
            </div>
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-ink" ref={menuRef}>
        {menuOpen && (
          <div className="border-b border-ink bg-paper">
            <Link
              to="/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-3 font-mono text-[11px] text-ink-soft hover:text-ink hover:bg-cream-2 transition-colors border-b border-line-faint"
            >
              <Settings size={13} />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-4 py-3 font-mono text-[11px] text-ink-soft hover:text-ink hover:bg-cream-2 transition-colors"
            >
                <LogOut size={13} />
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
