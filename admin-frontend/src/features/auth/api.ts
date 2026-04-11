import { supabase } from '@/shared/lib/supabase'
import { apiClient } from '@/shared/lib/api-client'

export const authApi = {

  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  registerOrganization: async (payload: {
    organization_name: string
    first_name: string
    last_name: string
  }) => {
    const { data } = await apiClient.post('/api/organization/', payload)
    return data
  },

  acceptInvite: async (payload: { first_name: string; last_name: string }) => {
    const { data } = await apiClient.post('/api/org-members/', payload)
    return data
  },
}
