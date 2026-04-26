import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { workersApi } from '@/features/workers/api'
import { invitationsApi } from '@/features/invitations/api'
import { InviteModal } from '@/features/invitations/components/InviteModal'
import { ROLE_LABELS } from '@/features/invitations/components/StatusBadge'
import { Avatar, Card, Kicker, StatusDot, Tag, Btn } from '@/shared/components/ui'
import type { Worker } from '@/features/workers/api'

export const Route = createFileRoute('/_protected/dashboard/workers/')({
  component: WorkersPage,
})

type Tab = 'workers' | 'invitations'

const AVATAR_COLORS = ['c1','c2','c3','c4','c5','c6'] as const

function WorkersPage() {
  const [tab, setTab] = useState<Tab>('workers')
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: workers = [], isLoading, isError } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.listWorkers,
  })

  const { data: invitations = [], isLoading: invLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: invitationsApi.listInvitations,
  })

  const revoke = useMutation({
    mutationFn: invitationsApi.revokeInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  })

  return (
    <div className="min-h-full bg-cream">
      {/* Page header */}
      <div className="flex items-end justify-between px-10 pt-10 pb-6">
        <div>
          <Kicker leader className="mb-4">03 / Personnel</Kicker>
          <h1 className="font-serif text-[52px] leading-[0.98] font-medium tracking-[-0.02em]">
            Workers{' '}
            <span className="font-serif italic text-muted">
              — {workers.length} on staff
            </span>
          </h1>
        </div>
        <Btn variant="ghost" onClick={() => setShowModal(true)}>＊ Invite member</Btn>
      </div>

      {/* Tabs */}
      <div className="px-10 mb-6">
        <div className="flex items-center gap-1 border-b border-ink pb-0">
          {(['workers', 'invitations'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] border border-b-0 transition-colors ${
                tab === t
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-transparent text-ink-soft border-transparent hover:border-line-soft hover:text-ink'
              }`}
            >
              {t === 'workers' ? `Workers (${workers.length})` : `Invitations (${invitations.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-10 pb-12">
        {tab === 'workers' && (
          <>
            {isLoading && (
              <p className="font-mono text-[11px] text-muted tracking-wide py-8">LOADING WORKERS…</p>
            )}
            {isError && (
              <p className="font-mono text-[11px] text-orange tracking-wide py-8">FAILED TO LOAD WORKERS</p>
            )}
            {!isLoading && !isError && workers.length === 0 && (
              <div className="border border-dashed border-ink p-16 text-center">
                <p className="font-serif text-[24px] mb-2">No workers yet</p>
                <p className="font-mono text-[11px] text-muted tracking-wide">USE THE INVITE BUTTON TO ADD STAFF</p>
              </div>
            )}
            {workers.length > 0 && (
              <div className="grid grid-cols-2 gap-0 border border-ink lg:grid-cols-3 xl:grid-cols-4">
                {workers.map((worker, i) => (
                  <WorkerRow key={worker.id} worker={worker} index={i} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'invitations' && (
          <>
            {invLoading ? (
              <p className="font-mono text-[11px] text-muted tracking-wide py-8">LOADING…</p>
            ) : invitations.length === 0 ? (
              <div className="border border-dashed border-ink p-16 text-center">
                <p className="font-serif text-[24px] mb-2">No invitations</p>
                <p className="font-mono text-[11px] text-muted tracking-wide">CLICK INVITE TO ADD A MEMBER</p>
              </div>
            ) : (
              <Card className="p-0">
                {/* Table header */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_40px] bg-cream-2 border-b border-ink">
                  {['Email', 'Role', 'Status', 'Invited', 'Expires', ''].map((h, i) => (
                    <div key={i} className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                      {h}
                    </div>
                  ))}
                </div>
                {invitations.map((inv, i) => (
                  <div
                    key={inv.id}
                    className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_40px] items-center hover:bg-cream-2 transition-colors ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}
                  >
                    <div className="px-4 py-3 text-[13px]">{inv.email}</div>
                    <div className="px-4 py-3 font-mono text-[11px] text-ink-soft">{ROLE_LABELS[inv.role] ?? inv.role}</div>
                    <div className="px-4 py-3">
                      <Tag variant={inv.accepted_at ? 'mint' : 'default'}>
                        {inv.accepted_at ? 'Accepted' : 'Pending'}
                      </Tag>
                    </div>
                    <div className="px-4 py-3 font-mono text-[11px] text-ink-soft">{new Date(inv.invited_at).toLocaleDateString()}</div>
                    <div className="px-4 py-3 font-mono text-[11px] text-ink-soft">{new Date(inv.expires_at).toLocaleDateString()}</div>
                    <div className="px-4 py-3">
                      {!inv.accepted_at && (
                        <button
                          onClick={() => revoke.mutate(inv.id)}
                          className="text-muted hover:text-orange transition-colors"
                          title="Revoke"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}
      </div>

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

function WorkerRow({ worker, index }: { worker: Worker; index: number }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const initials = `${worker.first_name[0]}${worker.last_name[0]}`
  const col = index % 4
  const row = Math.floor(index / 4)

  return (
    <Link
      to="/dashboard/workers/$workerId"
      params={{ workerId: worker.id } as never}
      className={`flex items-center gap-4 p-5 bg-paper hover:bg-cream-2 transition-colors lift
        ${col > 0 ? 'border-l border-ink' : ''}
        ${row > 0 ? 'border-t border-ink' : ''}
      `}
    >
      <Avatar initials={initials} color={color} size="lg" />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium leading-snug">
          {worker.first_name} {worker.last_name}
        </p>
        <p className="font-mono text-[10px] text-ink-soft mt-0.5 truncate">{worker.email}</p>
        <div className="mt-2">
          <StatusDot status={worker.is_active ? 'active' : 'inactive'} />
        </div>
      </div>
    </Link>
  )
}
