import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { Tag, Kicker, Avatar } from '@/shared/components/ui'
import { usePlacement, useFillPlacement, useClosePlacement } from '@/features/placements/hooks/usePlacements'
import type { PlacementStatus, InterestWorkerSummary } from '@/features/placements/api'

export const Route = createFileRoute('/_protected/dashboard/placements/$placementId')({
  component: PlacementDetailPage,
})

const STATUS_TAG: Record<PlacementStatus, { variant: 'orange' | 'mint' | 'default'; label: string }> = {
  open:   { variant: 'orange', label: 'Open' },
  filled: { variant: 'mint',   label: 'Filled' },
  closed: { variant: 'default', label: 'Closed' },
}

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-0.5'

const AVATAR_COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const

function PlacementDetailPage() {
  const { placementId } = Route.useParams()
  const { data: placement, isLoading, isError } = usePlacement(placementId)
  const { mutate: fill,  isPending: filling  } = useFillPlacement()
  const { mutate: close, isPending: closing  } = useClosePlacement()
  const [confirmClose, setConfirmClose]         = useState(false)
  const [error, setError]                       = useState<string | null>(null)

  if (isLoading) return <div className="p-10 font-mono text-[11px] text-muted">Loading…</div>
  if (isError || !placement) return <div className="p-10 font-mono text-[11px] text-orange">Placement not found.</div>

  const st     = STATUS_TAG[placement.status]
  const isOpen = placement.status === 'open'

  function handleFill(employmentId: string) {
    setError(null)
    fill(
      { id: placement!.id, payload: { employment_id: employmentId } },
      { onError: () => setError('Failed to fill placement.') },
    )
  }

  function handleClose() {
    setError(null)
    close(placement!.id, {
      onSuccess: () => setConfirmClose(false),
      onError:   () => setError('Failed to close placement.'),
    })
  }

  return (
    <div className="min-h-full bg-cream flex">

      {/* Left panel */}
      <div className="w-72 shrink-0 border-r border-ink flex flex-col p-8 gap-6 sticky top-0 overflow-y-auto" style={{ height: '100vh' }}>

        <Link to="/dashboard/placements" className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink">
          ← Placements
        </Link>

        <div>
          <Kicker className="mb-3">Placement</Kicker>
          <h1 className="font-serif text-[28px] leading-[1.1] font-medium tracking-[-0.02em]">
            {placement.client_first_name}<br />
            <em>{placement.client_last_name}</em>
          </h1>
          <div className="mt-3">
            <Tag variant={st.variant}>{st.label}</Tag>
          </div>
        </div>

        <div className="border-t border-ink" />

        <div className="space-y-4">
          <div>
            <p className={labelClass}>Area</p>
            <p className="text-[13px]">{placement.masked_location}</p>
          </div>
          <div>
            <p className={labelClass}>Shift</p>
            <p className="text-[13px] leading-snug">{placement.shift_description}</p>
          </div>
          {placement.requirements && (
            <div>
              <p className={labelClass}>Requirements</p>
              <p className="text-[13px] leading-snug">{placement.requirements}</p>
            </div>
          )}
          <div>
            <p className={labelClass}>Posted</p>
            <p className="text-[13px]">{format(new Date(placement.created_at), 'MMM d, yyyy')}</p>
          </div>
          {placement.resolved_at && (
            <div>
              <p className={labelClass}>Resolved</p>
              <p className="text-[13px]">{format(new Date(placement.resolved_at), 'MMM d, yyyy')}</p>
            </div>
          )}
          <div>
            <p className={labelClass}>Interest</p>
            <p className="text-[13px]">{placement.interests.length} worker{placement.interests.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {isOpen && (
          <>
            <div className="border-t border-ink" />
            {confirmClose ? (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[10px] text-orange">Close this placement without filling it?</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleClose}
                    disabled={closing}
                    className="flex-1 bg-ink text-cream px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] hover:bg-orange transition-colors disabled:opacity-40"
                  >
                    {closing ? 'Closing…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmClose(false)}
                    className="flex-1 border border-ink px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-soft hover:text-ink hover:bg-cream-2 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClose(true)}
                className="font-mono text-[10px] tracking-[0.05em] uppercase text-ink-soft hover:text-orange transition-colors"
              >
                Close without filling →
              </button>
            )}
          </>
        )}

        {error && (
          <p className="font-mono text-[10px] text-orange">{error}</p>
        )}
      </div>

      {/* Right: Interest list */}
      <div className="flex-1 min-w-0 p-10">
        <h2 className="font-serif text-[28px] leading-none font-medium tracking-[-0.02em] mb-6">
          {isOpen ? 'Interested workers' : 'Workers who expressed interest'}
        </h2>

        {placement.interests.length === 0 ? (
          <div className="border border-dashed border-ink p-16 text-center">
            <p className="font-serif text-[24px] mb-2">No interest yet</p>
            <p className="font-mono text-[11px] text-muted tracking-wide">
              WORKERS WILL APPEAR HERE AFTER RECEIVING THE PLACEMENT NOTIFICATION
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0 border border-ink">
            {/* Header */}
            <div className={`grid ${isOpen ? 'grid-cols-[2fr_2fr_1fr_120px]' : 'grid-cols-[2fr_2fr_1fr]'} bg-cream-2 border-b border-ink`}>
              {['Worker', 'Note', 'Expressed Interest', ...(isOpen ? [''] : [])].map((h) => (
                <div key={h} className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">{h}</div>
              ))}
            </div>
            {placement.interests.map((interest, i) => (
              <InterestRow
                key={interest.employment_id}
                interest={interest}
                index={i}
                isOpen={isOpen}
                filling={filling}
                onFill={handleFill}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function InterestRow({
  interest,
  index,
  isOpen,
  filling,
  onFill,
}: {
  interest: InterestWorkerSummary
  index: number
  isOpen: boolean
  filling: boolean
  onFill: (id: string) => void
}) {
  const color    = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const initials = `${interest.first_name[0] ?? ''}${interest.last_name[0] ?? ''}`.toUpperCase()

  return (
    <div className={`grid ${isOpen ? 'grid-cols-[2fr_2fr_1fr_120px]' : 'grid-cols-[2fr_2fr_1fr]'} items-center hover:bg-cream-2 transition-colors ${index > 0 ? 'border-t border-dashed border-line-soft' : ''}`}>
      <div className="px-4 py-3 flex items-center gap-3">
        <Avatar initials={initials} color={color} size="sm" />
        <p className="text-[13px] font-medium">{interest.first_name} {interest.last_name}</p>
      </div>
      <div className="px-4 py-3 font-mono text-[11px] text-ink-soft line-clamp-2">
        {interest.note ?? <span className="opacity-40">—</span>}
      </div>
      <div className="px-4 py-3 font-mono text-[10px] text-ink-soft">
        {formatDistanceToNow(new Date(interest.created_at), { addSuffix: true })}
      </div>
      {isOpen && (
        <div className="px-4 py-3">
          <button
            onClick={() => onFill(interest.employment_id)}
            disabled={filling}
            className="bg-ink text-cream px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.06em] hover:bg-orange transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {filling ? '…' : 'Fill Placement'}
          </button>
        </div>
      )}
    </div>
  )
}
