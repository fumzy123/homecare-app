import { type ClientStatus, CLIENT_STATUS_LABELS } from '@/features/clients/api'

const styles: Record<ClientStatus, string> = {
  active: 'bg-green-50 text-green-700',
  on_hold: 'bg-yellow-50 text-yellow-700',
  discharged: 'bg-gray-100 text-gray-500',
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {CLIENT_STATUS_LABELS[status]}
    </span>
  )
}
