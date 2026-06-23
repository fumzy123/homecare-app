import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { useNotifications, useMarkRead } from './hooks'
import { useOvertimeReviewStore } from './useOvertimeReviewStore'
import type { Notification, NotificationType } from './api'
import { DOCUMENT_LABELS } from '@/features/workers/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

function notificationTitle(n: Notification): string {
  const workerName = n.about_worker_first_name
    ? `${n.about_worker_first_name} ${n.about_worker_last_name}`
    : null
  switch (n.type as NotificationType) {
    case 'credential_uploaded': {
      const label = DOCUMENT_LABELS[n.payload.document_type as string] ?? n.payload.document_type
      return `${workerName} uploaded ${label}`
    }
    case 'profile_updated': {
      const fields = (n.payload.changed_fields as string[]) ?? []
      return `${workerName} updated their profile`
        + (fields.length ? ` (${fields.map((f) => f.replace(/_/g, ' ')).join(', ')})` : '')
    }
    case 'shift_dropped':
      return `${workerName} dropped a shift — ${n.payload.client_name ?? ''}`
    case 'overtime_approval_requested':
      return `${n.payload.requesting_member_name ?? 'Someone'} requested overtime for ${workerName}`
    case 'placement_created':
      return `New placement available — ${n.payload.masked_location ?? ''}`
    default:
      return workerName ? `Update from ${workerName}` : 'New notification'
  }
}

function notificationDestination(n: Notification): string {
  switch (n.type as NotificationType) {
    case 'credential_uploaded':
      return `/dashboard/workers/${n.about_worker_id}/documents`
    case 'profile_updated':
      return `/dashboard/workers/${n.about_worker_id}/edit`
    case 'shift_dropped':
      return `/dashboard/workers/${n.about_worker_id}`
    case 'placement_created':
      return `/dashboard/placements/${n.payload.placement_id}`
    default:
      return n.about_worker_id ? `/dashboard/workers/${n.about_worker_id}` : '/dashboard'
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NotificationItem({
  n,
  onAction,
}: {
  n: Notification
  onAction: (n: Notification, isUnread: boolean) => void
}) {
  const isUnread   = n.read_at === null
  const isResolved = n.resolved_at !== null

  return (
    <button
      onClick={() => onAction(n, isUnread)}
      className={`w-full text-left border-b border-line-faint px-4 py-3 transition-colors hover:bg-cream-2 ${
        isUnread ? 'bg-cream-2' : 'bg-paper'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-snug text-ink">
            {notificationTitle(n)}
          </p>
          <p className="mt-0.5 font-mono text-[9px] text-ink-soft">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {n.requires_action && !isResolved && (
            <span className="rounded-sm bg-orange px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white">
              Action needed
            </span>
          )}
          {isResolved && (
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">✓</span>
          )}
          {isUnread && (
            <div className="h-2 w-2 shrink-0 rounded-full bg-orange" />
          )}
        </div>
      </div>

      <p className="mt-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-soft text-right">
        View →
      </p>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen]            = useState(false)
  const ref                        = useRef<HTMLDivElement>(null)
  const navigate                   = useNavigate()
  const { data }                   = useNotifications()
  const { mutate: markRead }       = useMarkRead()
  const { open: openOvertimeReview } = useOvertimeReviewStore()

  const unread        = data?.unread_count ?? 0
  const actionNeeded  = data?.action_needed_count ?? 0
  const notifications = data?.notifications ?? []

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleAction(n: Notification, isUnread: boolean) {
    setOpen(false)
    if (isUnread) markRead(n.id)
    if (n.type === 'overtime_approval_requested') {
      openOvertimeReview(n)
      return
    }
    navigate({ to: notificationDestination(n) as never })
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center border border-ink bg-paper text-ink transition-colors hover:bg-cream-2"
        aria-label="Notifications"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange font-mono text-[8px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 border border-ink bg-paper shadow-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink">
                Notifications
              </span>
              {actionNeeded > 0 && (
                <span className="rounded-sm bg-orange px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white">
                  {actionNeeded} pending
                </span>
              )}
            </div>
            {unread > 0 && (
              <span className="font-mono text-[9px] text-ink-soft">
                {unread} unread
              </span>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                All clear
              </p>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} n={n} onAction={handleAction} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
