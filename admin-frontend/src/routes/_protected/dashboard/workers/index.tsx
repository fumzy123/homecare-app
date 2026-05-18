import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Trash2, RotateCcw } from 'lucide-react'
import { orgMembersApi, type OrgMember } from '@/features/org-members/api'
import { invitationsApi } from '@/features/invitations/api'
import { InviteModal } from '@/features/invitations/components/InviteModal'
import { ROLE_LABELS } from '@/features/invitations/constants'
import { Avatar, Card, Kicker, StatusDot, Tag, Btn } from '@/shared/components/ui'

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
    queryFn: () => orgMembersApi.listByRole('home_support_worker'),
  })

  const { data: invitations = [], isLoading: invLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: invitationsApi.listInvitations,
  })

  const revoke = useMutation({
    mutationFn: invitationsApi.revokeInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  })

  const [resendCooldowns, setResendCooldowns] = useState<Set<string>>(new Set())
  const RESEND_COOLDOWN_MS = 5 * 60 * 1000

  const resend = useMutation({
    mutationFn: invitationsApi.resendInvitation,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
      setResendCooldowns(prev => new Set([...prev, id]))
      setTimeout(() => {
        setResendCooldowns(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, RESEND_COOLDOWN_MS)
    },
  })

  return (
    <div className="min-h-full bg-cream">
      {/* Page header */}
      <div className="flex items-end justify-between max-md:flex-col max-md:items-start gap-4 px-10 max-md:px-4 pt-10 max-md:pt-6 pb-6">
        <div>
          <Kicker leader className="mb-4">02 / Profile Management - Workers</Kicker>
          <h1 className="font-serif text-[52px] max-md:text-[32px] leading-[0.98] font-medium tracking-[-0.02em]">
            Home Support{' '}
            {/* <span className="font-serif italic text-muted">
              — {workers.length} on staff
            </span> */}

            <span className="font-serif italic text-muted">
              workers.
            </span>
          </h1>
        </div>
        <Btn variant="ghost" onClick={() => setShowModal(true)}>＊ Invite new worker</Btn>
      </div>

      {/* Tabs */}
      <div className="px-10 max-md:px-4 mb-6">
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

      <div className="px-10 max-md:px-4 pb-12">
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
              <div className="grid grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-4">
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
              <div className="overflow-x-auto">
                <Card className="p-0 min-w-[560px]">
                  {/* Table header */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_72px] bg-cream-2 border-b border-ink">
                    {['Email', 'Role', 'Status', 'Invited', 'Expires', 'Accepted On', ''].map((h, i) => (
                      <div key={i} className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                        {h}
                      </div>
                    ))}
                  </div>
                  {invitations.map((inv, i) => {
                    const isExpired = !inv.accepted_at && new Date(inv.expires_at) < new Date()
                    return (
                      <div
                        key={inv.id}
                        className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_72px] items-center hover:bg-cream-2 transition-colors ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}
                      >
                        <div className="px-4 py-3 text-[13px]">{inv.email}</div>
                        <div className="px-4 py-3 font-mono text-[11px] text-ink-soft">{ROLE_LABELS[inv.role] ?? inv.role}</div>
                        <div className="px-4 py-3">
                          {inv.accepted_at
                            ? <Tag variant="mint">Accepted</Tag>
                            : isExpired
                            ? <Tag variant="default" className="opacity-50">Expired</Tag>
                            : <Tag variant="default">Pending</Tag>
                          }
                        </div>
                        <div className="px-4 py-3 font-mono text-[11px] text-ink-soft">{new Date(inv.invited_at).toLocaleDateString()}</div>
                        <div className="px-4 py-3 font-mono text-[11px] text-ink-soft">{new Date(inv.expires_at).toLocaleDateString()}</div>
                        <div className="px-4 py-3 font-mono text-[11px] text-ink-soft">
                          {inv.accepted_at ? new Date(inv.accepted_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                        </div>
                        <div className="px-4 py-3 flex items-center gap-2">
                          {!inv.accepted_at && (
                            <>
                              {isExpired && (
                                <button
                                  onClick={() => resend.mutate(inv.id)}
                                  disabled={resendCooldowns.has(inv.id)}
                                  className="text-muted hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={resendCooldowns.has(inv.id) ? 'Resend available in 5 minutes' : 'Resend invite'}
                                >
                                  <RotateCcw size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => revoke.mutate(inv.id)}
                                className="text-muted hover:text-orange transition-colors"
                                title="Revoke"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </Card>
              </div>
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

function WorkerRow({ worker, index }: { worker: OrgMember; index: number }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const initials = `${worker.first_name[0]}${worker.last_name[0]}`

  return (
    <Link
      to="/dashboard/workers/$workerId"
      params={{ workerId: worker.id } as never}
      className="flex items-center gap-4 p-5 bg-paper border border-ink hover:bg-cream-2 transition-colors lift"
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
