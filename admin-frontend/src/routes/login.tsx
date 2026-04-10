import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-gray-500">Login page — coming soon</p>
    </div>
  )
}
