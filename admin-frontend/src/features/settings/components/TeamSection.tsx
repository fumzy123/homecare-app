import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, RotateCcw } from 'lucide-react'
import { ROLE_LABELS, STAFF_ROLES } from '@/features/invitations/constants'
import { InviteModal } from '@/features/invitations/components/InviteModal'
import { useResendInvitation, useRevokeInvitation } from '@/features/invitations/hooks/useInvitations'
import { Tag, Btn } from '@/shared/components/ui'
import { useTeamDirectory } from '../hooks/useTeamDirectory'
import { TeamMembersTable } from './TeamMembersTable'

const RESEND_COOLDOWN_MS = 5 * 60 * 1000
const tabs = ['Staff members', 'Pending invitations'] as const

function LoadError({ label, retry }: { label: string; retry: () => void }) {
  return <p role="alert" className="px-6 py-4 text-orange">Couldn't refresh {label}. <button type="button" onClick={retry} className="underline underline-offset-4">Try again</button></p>
}

export function TeamSection() {
  const queryClient = useQueryClient()
  const { owners, staff, invitations } = useTeamDirectory()
  const [tab, setTab] = useState<0 | 1>(0)
  const [showModal, setShowModal] = useState(false)
  const [resendCooldowns, setResendCooldowns] = useState<Set<string>>(new Set())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const revoke = useRevokeInvitation()
  const resend = useResendInvitation(id => {
    setResendCooldowns(prev => new Set([...prev, id]))
    timers.current.push(setTimeout(() => {
      setResendCooldowns(prev => { const next = new Set(prev); next.delete(id); return next })
    }, RESEND_COOLDOWN_MS))
  })
  const adminInvitations = (invitations.data ?? []).filter(inv => STAFF_ROLES.includes(inv.role))
  const counts = [staff.isSuccess ? staff.data.length : null, invitations.isSuccess ? adminInvitations.length : null]
  const actionError = resend.error || revoke.error

  return (
    <div className="min-w-0 space-y-6">
      <section aria-labelledby="team-owners-heading" className="border border-ink bg-paper">
        <div className="px-6 py-4 border-b border-ink">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">A · Owners</p>
          <h3 id="team-owners-heading" className="font-serif text-[22px] leading-none font-medium mt-1">Organization <span className="italic text-muted">owners</span></h3>
        </div>
        {owners.isPending && <p role="status" className="px-6 py-8 text-ink-soft">Loading owners…</p>}
        {owners.isError && <LoadError label="owners" retry={() => { void owners.refetch() }} />}
        {owners.data && (owners.data.length ? <TeamMembersTable members={owners.data} caption="Organization owners" showRole={false} /> : owners.isSuccess && <p className="px-6 py-8 text-ink-soft">No owners found.</p>)}
      </section>

      <section aria-labelledby="team-staff-heading" className="border border-ink bg-paper">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-ink">
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">B · Staff</p>
            <h3 id="team-staff-heading" className="font-serif text-[22px] leading-none font-medium mt-1">Agency <span className="italic text-muted">staff</span></h3>
          </div>
          <Btn variant="ghost" onClick={() => setShowModal(true)}>＊ Invite staff</Btn>
        </div>
        <div role="tablist" aria-label="Agency staff" className="flex border-b border-line-soft px-4 sm:px-6">
          {tabs.map((label, index) => (
            <button key={label} id={`team-tab-${index}`} type="button" role="tab" aria-selected={tab === index} aria-controls={`team-panel-${index}`} tabIndex={tab === index ? 0 : -1}
              className={`px-3 py-4 text-[13px] border-b-2 focus-visible:outline-2 focus-visible:outline-offset-[-4px] ${tab === index ? 'border-ink font-semibold' : 'border-transparent text-ink-soft hover:text-ink'}`}
              onClick={() => setTab(index as 0 | 1)}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : tab === 0 ? 1 : 0
                setTab(next)
                document.getElementById(`team-tab-${next}`)?.focus()
              }}>
              {label}{counts[index] !== null && <span className="ml-2 font-mono text-[11px]">{counts[index]}</span>}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="team-panel-0" aria-labelledby="team-tab-0" hidden={tab !== 0} tabIndex={0}>
          {staff.isPending && <p role="status" className="px-6 py-8 text-ink-soft">Loading staff members…</p>}
          {staff.isError && <LoadError label="staff members" retry={() => { void staff.refetch() }} />}
          {staff.data && (staff.data.length ? <TeamMembersTable members={staff.data} caption="Staff members" /> : staff.isSuccess && <p className="px-6 py-8 text-ink-soft">No staff members have joined yet. Invite a staff member to get started.</p>)}
        </div>

        <div role="tabpanel" id="team-panel-1" aria-labelledby="team-tab-1" hidden={tab !== 1} tabIndex={0}>
          <p className="px-6 pt-4 text-[13px] text-ink-soft">Invitations awaiting acceptance, including expired invitations that can be resent.</p>
          {invitations.isPending && <p role="status" className="px-6 py-8 text-ink-soft">Loading invitations…</p>}
          {invitations.isError && <LoadError label="invitations" retry={() => { void invitations.refetch() }} />}
          {actionError && <p role="alert" className="px-6 py-4 text-orange">{actionError.message || 'Unable to update the invitation. Please try again.'}</p>}
          {invitations.data && (adminInvitations.length ? (
            <div className="overflow-x-auto mt-4">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <caption className="sr-only">Pending staff invitations</caption>
                <thead className="border-b border-line-soft bg-cream-2 font-mono text-[10px] uppercase tracking-wide text-ink-soft">
                  <tr>{['Email', 'Role', 'Status', 'Actions'].map(label => <th key={label} scope="col" className="px-6 py-3 font-normal">{label}</th>)}</tr>
                </thead>
                <tbody>{adminInvitations.map(inv => {
                  const isExpired = new Date(inv.expires_at) < new Date()
                  return <tr key={inv.id} className="border-t border-line-soft">
                    <th scope="row" className="px-6 py-4 font-normal break-all">{inv.email}</th>
                    <td className="px-6 py-4">{ROLE_LABELS[inv.role] ?? inv.role}</td>
                    <td className="px-6 py-4"><Tag variant="default">{isExpired ? 'Expired' : 'Pending'}</Tag></td>
                    <td className="px-6 py-4"><div className="flex items-center gap-3">
                      {isExpired && <button type="button" onClick={() => { revoke.reset(); resend.mutate(inv.id) }} disabled={resend.isPending || revoke.isPending || resendCooldowns.has(inv.id)}
                        aria-label={`Resend invite to ${inv.email}`} title={resendCooldowns.has(inv.id) ? 'Resend available in 5 minutes' : 'Resend invite'}
                        className="p-2 text-ink-soft hover:text-ink disabled:opacity-40"><RotateCcw size={16} /></button>}
                      <button type="button" onClick={() => { resend.reset(); revoke.mutate(inv.id) }} disabled={revoke.isPending || resend.isPending}
                        aria-label={`Revoke invite to ${inv.email}`} title="Revoke invite" className="p-2 text-ink-soft hover:text-orange disabled:opacity-40"><Trash2 size={16} /></button>
                    </div></td>
                  </tr>
                })}</tbody>
              </table>
            </div>
          ) : invitations.isSuccess && <p className="px-6 py-8 text-ink-soft">No pending invitations.</p>)}
        </div>
      </section>
      {showModal && <InviteModal showRoleSelector onClose={() => setShowModal(false)} onSuccess={() => {
        setTab(1)
        void queryClient.invalidateQueries({ queryKey: ['invitations'] })
      }} />}
    </div>
  )
}
