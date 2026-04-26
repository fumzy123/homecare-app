import { type Invitation } from '@/features/invitations/api'

export const ROLE_LABELS: Record<string, string> = {
  owner:               'Owner',
  agency_admin:        'Admin',
  home_support_worker: 'Worker',
}

export function StatusBadge({ invitation }: { invitation: Invitation }) {
  const now     = new Date()
  const expired = !invitation.accepted_at && new Date(invitation.expires_at) < now

  if (invitation.accepted_at) {
    return <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 border bg-ink text-cream border-ink">Active</span>
  }
  if (expired) {
    return <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 border border-orange text-orange">Expired</span>
  }
  return <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 border border-ink text-ink-soft">Pending</span>
}
