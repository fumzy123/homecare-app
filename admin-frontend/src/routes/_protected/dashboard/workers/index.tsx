import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { workersApi } from '@/features/workers/api'
import { WorkerCard } from '@/features/workers/components/WorkerCard'
import { invitationsApi } from '@/features/invitations/api'
import { InviteModal } from '@/features/invitations/components/InviteModal'
import { StatusBadge, ROLE_LABELS } from '@/features/invitations/components/StatusBadge'

export const Route = createFileRoute('/_protected/dashboard/workers/')({
  component: WorkersPage,
})

type Tab = 'workers' | 'invitations'

function WorkersPage() {
  const [tab, setTab] = useState<Tab>('workers')
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: workers = [], isLoading: workersLoading, isError: workersError } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.listWorkers,
  })

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: invitationsApi.listInvitations,
  })

  const revoke = useMutation({
    mutationFn: invitationsApi.revokeInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  })

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Workers</h1>
          {tab === 'workers' && !workersLoading && (
            <p className="mt-1 text-sm text-gray-500">
              {workers.length} {workers.length === 1 ? 'worker' : 'workers'}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          <Plus size={16} />
          Invite
        </button>
      </div>

      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {(['workers', 'invitations'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'workers' && (
        <>
          {workersLoading && <p className="text-sm text-gray-500">Loading workers...</p>}
          {workersError && <p className="text-sm text-red-500">Failed to load workers.</p>}
          {!workersLoading && !workersError && workers.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm font-medium text-gray-900">No workers yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Use the Invite button to add workers to your organisation.
              </p>
            </div>
          )}
          {workers.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {workers.map((worker) => (
                <WorkerCard key={worker.id} worker={worker} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'invitations' && (
        <>
          {invitationsLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : invitations.length === 0 ? (
            <p className="text-sm text-gray-500">No invitations yet. Click Invite to add a member.</p>
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
        </>
      )}

      {showModal && (
        <InviteModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['invitations'] })
            setTab('invitations')
          }}
        />
      )}
    </div>
  )
}
