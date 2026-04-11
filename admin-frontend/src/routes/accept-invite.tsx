import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { AcceptInviteForm } from '@/features/auth/components/AcceptInviteForm'

export const Route = createFileRoute('/accept-invite')({
  component: AcceptInvitePage,
})

function AcceptInvitePage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase processes the #access_token hash from the invite link asynchronously.
    // We wait for SIGNED_IN before showing the form — otherwise beforeLoad-style
    // guards fire before the session is established and bounce the user to /login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setReady(true)
      } else if (event === 'SIGNED_OUT') {
        navigate({ to: '/login' })
      }
    })

    // Handle the case where the user refreshes the page — session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Verifying your invite...</p>
      </div>
    )
  }

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
