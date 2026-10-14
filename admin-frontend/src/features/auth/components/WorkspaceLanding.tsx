import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useOperatorAccess, useOperatorSignOut } from '@/features/billing/hooks/useBillingOperator'
import { useAuthStore } from '@/shared/stores/auth'
import { ApiError } from '@/shared/lib/api-client'

// Layer 3: server-confirmed operator access selects the workspace, never email or metadata.
export function WorkspaceLanding() {
  const userId = useAuthStore(s => s.user?.id)
  const access = useOperatorAccess(userId)
  const signOut = useOperatorSignOut()
  const navigate = useNavigate()
  const agency = access.error instanceof ApiError && access.error.code === 'FORBIDDEN'
  useEffect(() => {
    if (access.data?.is_operator) void navigate({ to: '/billing-operations', replace: true })
    else if (agency) void navigate({ to: '/dashboard', replace: true })
  }, [access.data?.is_operator, agency, navigate])

  return <main className="min-h-screen bg-cream text-ink flex items-center justify-center p-6">
    <div className="space-y-4 max-w-md">
      <h1 className="font-serif text-3xl">Welcome to Care Harbor</h1>
      {access.isError && !agency ? <>
        <p role="alert">We couldn’t check your workspace access. Please try again.</p>
        <button className="border border-ink rounded-full px-4 py-2" onClick={() => void access.refetch()}>Try again</button>
      </> : <p>Opening your workspace…</p>}
      <button className="block underline" disabled={signOut.isPending} onClick={() => signOut.mutate()}>Sign out</button>
      {signOut.isError && <p role="alert">Could not sign out. Please try again.</p>}
    </div>
  </main>
}
