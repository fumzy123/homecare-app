import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/shared/lib/supabase'
import { BillingOperatorPage } from '@/features/billing/components/BillingOperatorPage'

export const Route = createFileRoute('/billing-operations')({
  beforeLoad: async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw redirect({ to: '/login' })
  },
  component: BillingOperatorPage,
})
