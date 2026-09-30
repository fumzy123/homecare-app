import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import { apiClient } from '@/shared/lib/api-client'

export type InvitationAccount = {
  status: 'active' | 'pending' | 'expired' | 'no_access'
  email: string
  first_name: string | null
  org_name: string | null
  role: string | null
}

export function useInvitationAccount() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [sessionError, setSessionError] = useState(false)
  useEffect(() => {
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setLoadingSession(false) }
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) { setSession(data.session); setSessionError(!!error); setLoadingSession(false) }
    }).catch(() => {
      if (active) { setSessionError(true); setLoadingSession(false) }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  const account = useQuery({
    queryKey: ['invitationAccount', session?.user.id],
    queryFn: async () => {
      const { data } = await apiClient.get<InvitationAccount>('/api/me/account', {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      })
      return data
    },
    enabled: !!session,
    staleTime: 0,
    retry: false,
  })
  return { session, loadingSession, sessionError, account }
}
