import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { LoginForm } from '@/features/auth/components/LoginForm'

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
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Sign in</h1>
        <p className="mb-6 text-sm text-gray-500">Welcome back to your agency dashboard</p>
        <LoginForm />
        <p className="mt-4 text-center text-xs text-gray-400">
          New agency?{' '}
          <Link to="/register" className="text-gray-700 underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
