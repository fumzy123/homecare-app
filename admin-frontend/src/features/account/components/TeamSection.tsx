import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, RotateCcw } from 'lucide-react'
import { orgMembersApi, type OrgMember } from '@/features/org-members/api'
import { invitationsApi } from '@/features/invitations/api'
import { InviteModal } from '@/features/invitations/components/InviteModal'
import { Tag, Btn, StatusDot } from '@/shared/components/ui'

const RESEND_COOLDOWN_MS = 5 * 60 * 1000

function MemberRow({ member, index }: { member: OrgMember; index: number }) {
  return (
    <div className={`grid grid-cols-[2fr_1fr_1fr] items-center px-6 py-3 ${index > 0 ? 'border-t border-dashed border-line-soft' : ''}`}>
      <div>
        <p className="text-[13px] font-medium">{member.first_name} {member.last_name}</p>
      </div>
      <p className="font-mono text-[11px] text-ink-soft">{member.email}</p>
      <StatusDot status={member.is_active ? 'active' : 'inactive'} />
    </div>
  )
}

export function TeamSection() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal]             = useState(false)
  const [resendCooldowns, setResendCooldowns] = useState<Set<string>>(new Set())

  const { data: owners = [] } = useQuery({
    queryKey: ['org-members', 'owner'],
    queryFn:  () => orgMembersApi.listByRole('owner'),
  })

  const { data: admins = [] } = useQuery({
    queryKey: ['org-members', 'agency_admin'],
    queryFn:  () => orgMembersApi.listByRole('agency_admin'),
  })

  const { data: allInvitations = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn:  invitationsApi.listInvitations,
  })

  const adminInvitations = allInvitations.filter(inv => inv.role === 'agency_admin')

  const revoke = useMutation({
    mutationFn: invitationsApi.revokeInvitation,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  })

  const resend = useMutation({
    mutationFn: invitationsApi.resendInvitation,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
      setResendCooldowns(prev => new Set([...prev, id]))
      setTimeout(() => {
        setResendCooldowns(prev => { const next = new Set(prev); next.delete(id); return next })
      }, RESEND_COOLDOWN_MS)
    },
  })

  const tableHeader = (cols: string[]) => (
    <div className={`grid grid-cols-[2fr_1fr_1fr] px-6 py-3 border-b border-ink bg-cream-2`}>
      {cols.map(h => (
        <p key={h} className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">{h}</p>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">

      {/* ── Owners ─────────────────────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="px-6 py-4 border-b border-ink">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">A · Owners</p>
          <h3 className="font-serif text-[22px] leading-none font-medium mt-1">
            Organization <span className="font-serif italic text-muted">owners</span>
          </h3>
        </div>
        {owners.length === 0 ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">NO OWNERS FOUND</p>
        ) : (
          <>
            {tableHeader(['Name', 'Email', 'Status'])}
            {owners.map((m, i) => <MemberRow key={m.id} member={m} index={i} />)}
          </>
        )}
      </div>

      {/* ── Admins ─────────────────────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">B · Admins</p>
            <h3 className="font-serif text-[22px] leading-none font-medium mt-1">
              Agency <span className="font-serif italic text-muted">administrators</span>
            </h3>
          </div>
          <Btn variant="ghost" onClick={() => setShowModal(true)}>＊ Invite admin</Btn>
        </div>
        {admins.length === 0 ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">NO ADMINS YET</p>
        ) : (
          <>
            {tableHeader(['Name', 'Email', 'Status'])}
            {admins.map((m, i) => <MemberRow key={m.id} member={m} index={i} />)}
          </>
        )}
      </div>

      {/* ── Admin invitations ──────────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="px-6 py-4 border-b border-ink">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">C · Pending admin invitations</p>
          <h3 className="font-serif text-[22px] leading-none font-medium mt-1">
            Sent invites <span className="font-serif italic text-muted">&amp; status</span>
          </h3>
        </div>
        {adminInvitations.length === 0 ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">NO ADMIN INVITATIONS SENT YET</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_60px] px-6 py-3 border-b border-ink bg-cream-2 min-w-[540px]">
              {['Email', 'Status', 'Invited', 'Accepted On', ''].map(h => (
                <p key={h} className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">{h}</p>
              ))}
            </div>
            {adminInvitations.map((inv, i) => {
              const isExpired = !inv.accepted_at && new Date(inv.expires_at) < new Date()
              return (
                <div key={inv.id} className={`grid grid-cols-[2fr_1fr_1fr_1fr_60px] items-center px-6 py-3 min-w-[540px] ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}>
                  <p className="text-[13px]">{inv.email}</p>
                  <div>
                    {inv.accepted_at
                      ? <Tag variant="mint">Accepted</Tag>
                      : isExpired
                      ? <Tag variant="default" className="opacity-50">Expired</Tag>
                      : <Tag variant="default">Pending</Tag>
                    }
                  </div>
                  <p className="font-mono text-[11px] text-ink-soft">{new Date(inv.invited_at).toLocaleDateString()}</p>
                  <p className="font-mono text-[11px] text-ink-soft whitespace-nowrap">
                    {inv.accepted_at
                      ? new Date(inv.accepted_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : '—'}
                  </p>
                  <div className="flex items-center gap-2">
                    {!inv.accepted_at && (
                      <>
                        {isExpired && (
                          <button
                            onClick={() => resend.mutate(inv.id)}
                            disabled={resendCooldowns.has(inv.id)}
                            className="text-muted hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={resendCooldowns.has(inv.id) ? 'Resend available in 5 minutes' : 'Resend invite'}
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => revoke.mutate(inv.id)}
                          className="text-muted hover:text-orange transition-colors"
                          title="Revoke"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <InviteModal
          role="agency_admin"
          onClose={() => setShowModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['invitations'] })}
        />
      )}
    </div>
  )
}
