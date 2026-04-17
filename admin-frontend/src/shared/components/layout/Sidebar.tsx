import { Link, useNavigate } from '@tanstack/react-router'
import { LayoutDashboard, Users, UserRound, CalendarDays, UsersRound, LogOut, Settings } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { useAuthStore } from '@/shared/stores/auth'
import { authApi } from '@/features/auth/api'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/workers', label: 'Workers', icon: Users },
  { to: '/dashboard/clients', label: 'Clients', icon: UserRound },
  { to: '/dashboard/shifts', label: 'Shifts', icon: CalendarDays },
  { to: '/team', label: 'Team', icon: UsersRound },
]

export function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : '?'

  async function handleSignOut() {
    await authApi.signOut()
    clearAuth()
    navigate({ to: '/login' })
  }

  // Close menu when clicking outside
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
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white px-4 py-6">
      <div className="mb-8 px-2">
        <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
          Homecare
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 [&.active]:bg-gray-100 [&.active]:font-medium [&.active]:text-gray-900"
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Profile row */}
      <div className="relative" ref={menuRef}>
        {/* Popup menu */}
        {menuOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-gray-200 bg-white shadow-md overflow-hidden">
            <Link
              to="/account"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Settings size={15} />
              Account Settings
            </Link>
            <div className="border-t border-gray-100" />
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        )}

        {/* Avatar button */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-gray-100"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {user?.firstName} {user?.lastName}
            </p>
          </div>
        </button>
      </div>
    </aside>
  )
}
