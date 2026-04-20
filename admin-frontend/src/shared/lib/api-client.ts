import axios from 'axios'
import { useAuthStore } from '@/shared/stores/auth'
import { supabase } from '@/shared/lib/supabase'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_API_URL ?? 'http://127.0.0.1:8000',
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
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      supabase.auth.signOut()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)
