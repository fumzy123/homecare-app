import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { AcceptInviteForm } from '@/features/auth/components/AcceptInviteForm'

export const Route = createFileRoute('/accept-invite')({
  beforeLoad: () => {
    // User must have a session from clicking the invite link
    // Supabase processes the token in the URL and fires onAuthStateChange
    // which populates Zustand — if it's empty, the invite link wasn't used
    const token = useAuthStore.getState().accessToken
    if (!token) {
      throw redirect({ to: '/login' })
    }
  },
  component: AcceptInvitePage,
})

function AcceptInvitePage() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Complete your account</h1>
        <p className="mb-6 text-sm text-gray-500">
          Enter your name to finish setting up your account
        </p>
        <AcceptInviteForm />
      </div>
    </div>
  )
}
