import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const { accessToken } = useAuthStore.getState()
    throw redirect({ to: accessToken ? '/dashboard' : '/login' })
  },
})
