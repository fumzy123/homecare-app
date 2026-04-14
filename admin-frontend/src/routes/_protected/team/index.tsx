import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { teamApi } from '@/features/team/api'
import { InviteModal } from '@/features/team/components/InviteModal'
import { StatusBadge, ROLE_LABELS } from '@/features/team/components/StatusBadge'

export const Route = createFileRoute('/_protected/team/')({
  component: TeamPage,
})

function TeamPage() {
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: teamApi.listInvitations,
  })

  const revoke = useMutation({
    mutationFn: teamApi.revokeInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  })

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Team</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          <Plus size={16} />
          Invite
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : invitations.length === 0 ? (
        <p className="text-sm text-gray-500">No invitations yet. Click Invite to add a team member.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Invited</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{inv.email}</td>
                  <td className="px-4 py-3 text-gray-600">{ROLE_LABELS[inv.role] ?? inv.role}</td>
                  <td className="px-4 py-3"><StatusBadge invitation={inv} /></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(inv.invited_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(inv.expires_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {!inv.accepted_at && (
                      <button
                        onClick={() => revoke.mutate(inv.id)}
                        className="text-gray-400 hover:text-red-500"
                        title="Revoke invite"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <InviteModal
          onClose={() => setShowModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['invitations'] })}
        />
      )}
    </div>
  )
}
