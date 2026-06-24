import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orgMembersApi, type OrgMember } from '@/features/org-members/api'

export function WorkerDangerZone({ worker }: { worker: OrgMember }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError]     = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => orgMembersApi.deleteOrgMember(worker.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      navigate({ to: '/dashboard/workers' })
    },
    onError: (err: Error) => setDeleteError(err.message),
  })

  return (
    <section className="border border-orange bg-paper">
      <div className="px-7 py-[18px] border-b border-orange">
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-orange">04 — Danger zone</p>
      </div>
      <div className="px-7 py-[22px] flex items-center justify-between gap-6">
        <div>
          <p className="text-[14px] font-medium mb-[3px]">Deactivate this worker</p>
          <p className="text-[12.5px] text-ink-soft">
            Revokes their access and removes them from all schedules. Their record
            and history are kept — you can bring them back later by re-inviting them.
          </p>
          {deleteError && (
            <p className="font-mono text-[10px] text-orange mt-2">{deleteError}</p>
          )}
        </div>
        <div className="shrink-0">
          {deleteConfirm ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-ink-soft uppercase tracking-wide">Are you sure?</span>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="bg-orange text-white px-4 py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
              >
                {deleteMutation.isPending ? 'Deactivating…' : 'Yes, deactivate'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="border border-ink px-4 py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="border border-orange text-orange px-4 py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-orange hover:text-white transition-colors"
            >
              Deactivate worker
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
