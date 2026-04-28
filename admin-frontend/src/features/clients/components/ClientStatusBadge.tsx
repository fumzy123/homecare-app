import { type ClientStatus, CLIENT_STATUS_LABELS } from '@/features/clients/api'

const styles: Record<ClientStatus, string> = {
  active:     'bg-ink text-cream border-ink',
  on_hold:    'border-ink text-ink-soft',
  discharged: 'border-line-soft text-muted',
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <span className={`font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 border ${styles[status]}`}>
      {CLIENT_STATUS_LABELS[status]}
    </span>
  )
}
