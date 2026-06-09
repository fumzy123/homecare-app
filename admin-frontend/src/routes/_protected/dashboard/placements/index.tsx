import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { Kicker, Tag, Btn } from '@/shared/components/ui'
import { usePlacements } from '@/features/placements/hooks/usePlacements'
import { PostPlacementDrawer } from '@/features/placements/components/PostPlacementDrawer'
import { useQuery } from '@tanstack/react-query'
import { clientsApi } from '@/features/clients/api'
import type { PlacementStatus } from '@/features/placements/api'

export const Route = createFileRoute('/_protected/dashboard/placements/')({
  component: PlacementsPage,
})

type Tab = 'all' | PlacementStatus

const STATUS_TAG: Record<PlacementStatus, { variant: 'orange' | 'mint' | 'default'; label: string }> = {
  open:   { variant: 'orange', label: 'Open' },
  filled: { variant: 'mint',   label: 'Filled' },
  closed: { variant: 'default', label: 'Closed' },
}

function PlacementsPage() {
  const [tab, setTab]           = useState<Tab>('all')
  const [showDrawer, setShowDrawer] = useState(false)

  const statusFilter = tab === 'all' ? undefined : tab
  const { data: placements = [], isLoading, isError } = usePlacements(statusFilter)
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.listClients(),
  })

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all',    label: `All (${placements.length})` },
    { key: 'open',   label: 'Open' },
    { key: 'filled', label: 'Filled' },
    { key: 'closed', label: 'Closed' },
  ]

  return (
    <div className="min-h-full bg-cream">

      {/* Header */}
      <div className="flex items-end justify-between max-md:flex-col max-md:items-start gap-4 px-10 max-md:px-4 pt-10 max-md:pt-6 pb-6">
        <div>
          <Kicker leader className="mb-4">06 / Placements</Kicker>
          <h1 className="font-serif text-[52px] max-md:text-[32px] leading-[0.98] font-medium tracking-[-0.02em]">
            Open{' '}
            <span className="font-serif italic text-muted">placements.</span>
          </h1>
        </div>
        <Btn variant="ghost" onClick={() => setShowDrawer(true)}>＊ Post placement</Btn>
      </div>

      {/* Tabs */}
      <div className="px-10 max-md:px-4 mb-6">
        <div className="flex items-center gap-1 border-b border-ink pb-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] border border-b-0 transition-colors ${
                tab === key
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-transparent text-ink-soft border-transparent hover:border-line-soft hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-10 max-md:px-4 pb-12">
        {isLoading && (
          <p className="font-mono text-[11px] text-muted tracking-wide py-8">LOADING…</p>
        )}
        {isError && (
          <p className="font-mono text-[11px] text-orange tracking-wide py-8">FAILED TO LOAD PLACEMENTS</p>
        )}
        {!isLoading && !isError && placements.length === 0 && (
          <div className="border border-dashed border-ink p-16 text-center">
            <p className="font-serif text-[24px] mb-2">No placements yet</p>
            <p className="font-mono text-[11px] text-muted tracking-wide">POST A CLIENT AS AVAILABLE TO START MATCHING</p>
          </div>
        )}
        {placements.length > 0 && (
          <div className="flex flex-col gap-0 border border-ink">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1.5fr_2fr_80px_80px_100px] bg-cream-2 border-b border-ink">
              {['Client', 'Location', 'Shift', 'Interest', 'Posted', 'Status'].map((h) => (
                <div key={h} className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                  {h}
                </div>
              ))}
            </div>
            {placements.map((p, i) => {
              const st = STATUS_TAG[p.status]
              return (
                <Link
                  key={p.id}
                  to="/dashboard/placements/$placementId"
                  params={{ placementId: p.id } as never}
                  className={`grid grid-cols-[2fr_1.5fr_2fr_80px_80px_100px] items-center hover:bg-cream-2 transition-colors ${i > 0 ? 'border-t border-dashed border-line-soft' : ''}`}
                >
                  <div className="px-4 py-3">
                    <p className="text-[13px] font-medium">{p.client_first_name} {p.client_last_name}</p>
                  </div>
                  <div className="px-4 py-3 font-mono text-[11px] text-ink-soft truncate">{p.masked_location}</div>
                  <div className="px-4 py-3 font-mono text-[11px] text-ink-soft line-clamp-2 leading-snug">{p.shift_description}</div>
                  <div className="px-4 py-3 font-mono text-[11px] text-ink-soft">{p.interest_count}</div>
                  <div className="px-4 py-3 font-mono text-[10px] text-ink-soft">
                    {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </div>
                  <div className="px-4 py-3">
                    <Tag variant={st.variant}>{st.label}</Tag>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {showDrawer && (
        <PostPlacementDrawer
          clients={clients}
          onClose={() => setShowDrawer(false)}
        />
      )}
    </div>
  )
}
