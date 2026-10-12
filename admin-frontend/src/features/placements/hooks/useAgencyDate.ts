import { useBillingStatus } from '@/features/billing/hooks/useBillingStatus'
import { useAuthStore } from '@/shared/stores/auth'

export function useAgencyDate() {
  const userId = useAuthStore((s) => s.user?.id)
  const billing = useBillingStatus(userId)
  const timezone = billing.data?.billing_timezone
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
