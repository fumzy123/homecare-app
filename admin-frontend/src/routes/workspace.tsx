import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/shared/lib/supabase'
import { WorkspaceLanding } from '@/features/auth/components/WorkspaceLanding'

export const Route = createFileRoute('/workspace')({
  beforeLoad: async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw redirect({ to: '/login' })
    if (!user.email_confirmed_at) throw redirect({ to: '/confirm-email' })
  },
  component: WorkspaceLanding,
})
