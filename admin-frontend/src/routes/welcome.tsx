import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'

export const Route = createFileRoute('/welcome')({
  component: WelcomePage,
})

function WelcomePage() {
  const [orgName, setOrgName] = useState<string>('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const name = session?.user?.user_metadata?.org_name ?? ''
      setOrgName(name)
    })
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-10 shadow-sm text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        </div>

        <h1 className="mb-2 text-xl font-semibold text-gray-900">Account successfully created</h1>

        <p className="text-sm text-gray-500 leading-relaxed">
          You will be notified via email to download the Homecare Worker app on your iOS or
          Android phone once development of the mobile app is complete.
          {orgName && (
            <>
              {' '}In the meantime, welcome to <span className="font-medium text-gray-700">{orgName}</span>.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
