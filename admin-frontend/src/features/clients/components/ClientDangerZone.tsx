import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clientsApi } from '@/features/clients/api'

export function ClientDangerZone({ clientId }: { clientId: string }) {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError]     = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => clientsApi.deleteClient(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      navigate({ to: '/dashboard/clients' })
    },
    onError: (err: Error) => setDeleteError(err.message),
  })

  return (
    <section className="border border-orange bg-paper">
      <div className="px-6 py-4 border-b border-orange">
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-orange">Danger zone</p>
      </div>
      <div className="px-6 py-5">
        <p className="font-mono text-[11px] text-ink-soft mb-4">Deleting a client is permanent and cannot be undone.</p>
        {deleteError && <p className="font-mono text-[10px] text-orange mb-3">{deleteError}</p>}
        {deleteConfirm ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-ink-soft uppercase tracking-wide">Are you sure?</span>
            <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
              className="bg-orange text-white px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
              {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button onClick={() => setDeleteConfirm(false)}
              className="border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setDeleteConfirm(true)}
            className="border border-orange text-orange px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-orange hover:text-white transition-colors">
            Delete Client
          </button>
        )}
      </div>
    </section>
  )
}
