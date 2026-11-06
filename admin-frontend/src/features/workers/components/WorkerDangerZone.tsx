import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { OrgMember } from '@/features/org-members/api'
import { useDeleteWorker } from '../hooks/useWorkerProfile'

export function WorkerDangerZone({
  worker,
  disabled = false,
}: {
  worker: OrgMember
  disabled?: boolean
}) {
  const navigate = useNavigate()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const deleteMutation = useDeleteWorker(worker.id)

  return (
    <section className="border border-orange bg-paper">
      <div className="px-7 py-[18px] border-b border-orange">
        <h3>Worker access</h3>
      </div>
      <div className="px-7 py-[22px] flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-[14px] font-medium mb-[3px]">
            Deactivate this worker
          </p>
          <p className="text-[12.5px] text-ink-soft">
            Ends their employment and removes them from the active roster.
            Review their future shifts and assignments separately. Their record
            and history are kept; re-invite them if they return.
          </p>
          {deleteError && (
            <p className="font-mono text-[10px] text-orange mt-2">
              {deleteError}
            </p>
          )}
        </div>
        <div className="shrink-0">
          {deleteConfirm ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-ink-soft uppercase tracking-wide">
                Are you sure?
              </span>
              <button
                onClick={() =>
                  deleteMutation.mutate(undefined, {
                    onSuccess: () =>
                      void navigate({
                        to: '/dashboard/workers',
                        ignoreBlocker: true,
                      }),
                    onError: (err) => setDeleteError(err.message),
                  })
                }
                disabled={disabled || deleteMutation.isPending}
                className="bg-orange text-white px-4 py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity"
              >
                {deleteMutation.isPending ? 'Deactivating…' : 'Yes, deactivate'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={disabled || deleteMutation.isPending}
                className="border border-ink px-4 py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              disabled={disabled}
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
