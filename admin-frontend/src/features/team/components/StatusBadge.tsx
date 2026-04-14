import { type Invitation } from '@/features/team/api'

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  agency_admin: 'Admin',
  home_support_worker: 'Worker',
}

export function StatusBadge({ invitation }: { invitation: Invitation }) {
  const now = new Date()
  const expired = !invitation.accepted_at && new Date(invitation.expires_at) < now

  if (invitation.accepted_at) {
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>
  }
  if (expired) {
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Expired</span>
  }
  return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Pending</span>
}
