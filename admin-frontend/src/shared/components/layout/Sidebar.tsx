import { Link, useNavigate } from '@tanstack/react-router'
import { LayoutDashboard, Users, UserRound, CalendarDays, LogOut } from 'lucide-react'
import { useAuthStore } from '@/shared/stores/auth'
import { authApi } from '@/features/auth/api'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/workers', label: 'Workers', icon: Users },
  { to: '/dashboard/clients', label: 'Clients', icon: UserRound },
  { to: '/dashboard/shifts', label: 'Shifts', icon: CalendarDays },
]

export function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleSignOut() {
    await authApi.signOut()
    clearAuth()
    navigate({ to: '/login' })
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white px-4 py-6">
      <div className="mb-8 px-2">
        <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
          Homecare
        </p>
        <p className="mt-1 text-sm font-semibold text-gray-800">
          {user?.firstName} {user?.lastName}
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

      <button
        onClick={handleSignOut}
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <LogOut size={16} />
        Sign out
      </button>
    </aside>
  )
}
