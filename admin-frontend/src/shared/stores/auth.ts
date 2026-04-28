import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  termsAcceptedVersion: string | null
  setAuth: (token: string, user: AuthUser) => void
  setTermsAccepted: (version: string) => void
  updateUser: (updates: Partial<AuthUser>) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      termsAcceptedVersion: null,
      setAuth: (token, user) => set({ accessToken: token, user }),
      setTermsAccepted: (version) => set({ termsAcceptedVersion: version }),
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
      clearAuth: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'auth-storage',
    },
  ),
)
