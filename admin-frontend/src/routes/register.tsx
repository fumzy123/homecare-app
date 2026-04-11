import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { RegisterForm } from '@/features/auth/components/RegisterForm'

export const Route = createFileRoute('/register')({
  beforeLoad: () => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: RegisterPage,
})

function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Register your agency</h1>
        <p className="mb-6 text-sm text-gray-500">Create your organization and admin account</p>
        <RegisterForm />
        <p className="mt-4 text-center text-xs text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-gray-700 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
