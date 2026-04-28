import axios from 'axios'
import { useAuthStore } from '@/shared/stores/auth'
import { supabase } from '@/shared/lib/supabase'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_API_URL ?? 'http://127.0.0.1:8000',
  timeout: 15000,
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If it's a 401 and we haven't retried yet, the short-lived JWT likely expired.
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      // Consult Supabase. This intelligently returns the session, and triggers
      // an automatic refresh if the access token has expired but the refresh token is valid.
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // The token was successfully refreshed in the background. 
        // Sync it to Zustand, patch the request headers, and quietly retry.
        useAuthStore.getState().setAuth(session.access_token, {
          id: session.user.id,
          email: session.user.email ?? '',
          firstName: session.user.user_metadata?.first_name ?? '',
          lastName: session.user.user_metadata?.last_name ?? '',
          role: session.user.user_metadata?.role ?? '',
        })
        originalRequest.headers.Authorization = `Bearer ${session.access_token}`
        return apiClient(originalRequest)
      } else {
        // Both access and refresh tokens are completely dead. Hard log out.
        useAuthStore.getState().clearAuth()
        await supabase.auth.signOut()
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)
