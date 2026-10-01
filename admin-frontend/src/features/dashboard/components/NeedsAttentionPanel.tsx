import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { format } from 'date-fns'
import { Card, Kicker } from '@/shared/components/ui'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { useExpiringCredentials } from '@/features/workers/hooks/useExpiringCredentials'
import { useExpiringAuthorizations } from '@/features/authorizations/hooks/useAuthorizations'
import { DOCUMENT_LABELS } from '@/features/workers/constants'
import { AttentionReviewSection } from './AttentionReviewSection'
import { CareActions } from './CareActions'

interface NeedsAttentionPanelProps {
  droppedShifts: ShiftOccurrence[]
  droppedPending: boolean
  droppedError: boolean
  onRetryDropped: () => void
  onSelectShift: (shift: ShiftOccurrence) => void
  children?: ReactNode
}

// Layer 3: uses the existing alert hooks and coordinates review actions.
export function NeedsAttentionPanel({
  droppedShifts, droppedPending, droppedError, onRetryDropped, onSelectShift, children,
}: NeedsAttentionPanelProps) {
  const credentials = useExpiringCredentials()
  const authorizations = useExpiringAuthorizations()
  const expiringCredentials = [...(credentials.data ?? [])].sort((a, b) => a.days_remaining - b.days_remaining)
  const expiringAuthorizations = [...(authorizations.data ?? [])].sort((a, b) => a.days_remaining - b.days_remaining)
  const dropped = [...droppedShifts].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  const needsCoverage = !droppedPending && !droppedError && dropped.length > 0

  function shiftLink(shift: ShiftOccurrence) {
    return <button
      key={`${shift.shift_id}-${shift.date}`}
      type="button"
      onClick={() => onSelectShift(shift)}
      className="block w-full text-left text-[12px] leading-relaxed hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="block font-medium">{shift.client.first_name} {shift.client.last_name}</span>
      <span className="font-mono text-[10px]">{format(new Date(shift.start_time), 'EEE, MMM d · h:mm a')}</span>
    </button>
  }

  return (
    <Card className="p-0 min-w-0">
      <section aria-label="Needs attention">
        <div className={`px-6 py-6 border-b border-ink ${needsCoverage ? 'bg-orange text-ink' : 'bg-paper'}`}>
          <Kicker className="mb-4 !text-ink">B / Needs attention</Kicker>
          {droppedPending ? <p role="status" className="text-[12px]">Checking dropped shifts…</p>
            : droppedError ? <div role="alert" className="text-[12px]">
              <p>Could not check dropped shifts.</p>
              <button type="button" className="mt-3 underline underline-offset-4" onClick={onRetryDropped}>Retry dropped shifts</button>
            </div>
              : needsCoverage ? <>
                <h3 className="font-serif text-[36px] leading-[1.05] tracking-[-0.02em] mb-5">
                  {dropped.length} {dropped.length === 1 ? 'shift' : 'shifts'}.<br />Coverage to review.
                </h3>
                <div className="space-y-3">{dropped.slice(0, 2).map(shiftLink)}</div>
                <button type="button" onClick={() => onSelectShift(dropped[0])}
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink bg-ink px-4 py-2 font-mono text-[11px] text-cream hover:bg-paper hover:text-ink transition-colors">
                  Resolve coverage<ArrowUpRight size={15} aria-hidden="true" />
                </button>
                {dropped.length > 2 && <details className="mt-4">
                  <summary className="cursor-pointer font-mono text-[11px]">View {dropped.length - 2} more dropped {dropped.length - 2 === 1 ? 'shift' : 'shifts'}</summary>
                  <div className="space-y-3 mt-3">{dropped.slice(2).map(shiftLink)}</div>
                </details>}
              </> : <>
                <h3 className="font-serif text-[28px] leading-tight">No dropped shifts</h3>
                <p className="mt-2 text-[12px] text-ink-soft">None found in the past 7 days or next 60 days.</p>
              </>}
        </div>

        <AttentionReviewSection title="Expiring credentials" description="Within the next 30 days"
          count={expiringCredentials.length} action="Review workers" isPending={credentials.isPending} isError={credentials.isError}
          onRetry={() => void credentials.refetch()}
          emptyMessage="No upcoming expirations. Worker records may still have missing or already expired credentials."
          emptyAction={<Link to="/dashboard/workers" className="inline-flex items-center gap-2 hover:underline">Review workers<ArrowRight size={14} aria-hidden="true" /></Link>}>
          {expiringCredentials.map((credential) => <li key={credential.id}>
            <Link to="/dashboard/workers/$workerId/edit" params={{ workerId: credential.worker_id }}
              className="flex items-start justify-between gap-3 px-6 py-4 hover:bg-cream-2 transition-colors">
              <span className="min-w-0"><span className="block text-[12px] font-medium">{credential.worker_first_name} {credential.worker_last_name}</span>
                <span className="block mt-1 font-mono text-[10px] text-ink-soft">{DOCUMENT_LABELS[credential.document_type] ?? credential.document_type}</span></span>
              <span className="shrink-0 text-right font-mono text-[10px]"><span className={credential.days_remaining <= 7 ? 'text-orange' : 'text-ink-soft'}>{credential.days_remaining === 0 ? 'Today' : `${credential.days_remaining}d`}</span><span className="block mt-1 text-ink-soft">{credential.expiry_date}</span></span>
            </Link>
          </li>)}
        </AttentionReviewSection>

        <AttentionReviewSection title="Care authorizations" description="Renewals within the next 15 days"
          count={expiringAuthorizations.length} action="Review clients" isPending={authorizations.isPending} isError={authorizations.isError}
          onRetry={() => void authorizations.refetch()}
          emptyMessage="No upcoming expirations. Client records may still have missing or already expired authorizations."
          emptyAction={<Link to="/dashboard/clients" className="inline-flex items-center gap-2 hover:underline">Review clients<ArrowRight size={14} aria-hidden="true" /></Link>}>
          {expiringAuthorizations.map((authorization) => <li key={authorization.authorization_id}>
            <Link to="/dashboard/clients/$clientId/care-need" params={{ clientId: authorization.client_id }}
              className="flex items-start justify-between gap-3 px-6 py-4 hover:bg-cream-2 transition-colors">
              <span className="min-w-0"><span className="block text-[12px] font-medium">{authorization.client_first_name} {authorization.client_last_name}</span>
                <span className="block mt-1 font-mono text-[10px] text-ink-soft break-words">{authorization.funder} · {authorization.authorization_number}</span></span>
              <span className="shrink-0 text-right font-mono text-[10px]"><span className={authorization.days_remaining <= 7 ? 'text-orange' : 'text-ink-soft'}>{authorization.days_remaining === 0 ? 'Today' : `${authorization.days_remaining}d`}</span><span className="block mt-1 text-ink-soft">{authorization.covering_end}</span></span>
            </Link>
          </li>)}
        </AttentionReviewSection>
        {children}
        <CareActions />
      </section>
    </Card>
  )
}
