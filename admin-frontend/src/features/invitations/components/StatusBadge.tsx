import { type Invitation } from '@/features/invitations/api'

export function StatusBadge({ invitation }: { invitation: Invitation }) {
  // Only pending invites exist — accepted ones are deleted on accept.
  const expired = new Date(invitation.expires_at) < new Date()

  if (expired) {
    return <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 border border-orange text-orange">Expired</span>
  }
  return <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 border border-ink text-ink-soft">Pending</span>
}
