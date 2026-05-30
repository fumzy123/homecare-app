import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useNotifications, useMarkRead, useMarkResolved } from './hooks'
import type { Notification, NotificationType } from './api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function notificationTitle(n: Notification): string {
  const name = `${n.worker_first_name} ${n.worker_last_name}`
  switch (n.type as NotificationType) {
    case 'credential_uploaded': {
      const label = DOCUMENT_LABELS[n.payload.document_type as string] ?? n.payload.document_type
      return `${name} uploaded ${label}`
    }
    case 'profile_updated': {
      const fields = (n.payload.changed_fields as string[]) ?? []
      return `${name} updated their profile`
        + (fields.length ? ` (${fields.map(humaniseField).join(', ')})` : '')
    }
    case 'shift_dropped':
      return `${name} dropped a shift — ${n.payload.client_name ?? ''}`
    default:
      return `Update from ${name}`
  }
}

function humaniseField(f: string): string {
  return f.replace(/_/g, ' ')
}

const DOCUMENT_LABELS: Record<string, string> = {
  first_aid_cpr:           'First Aid / CPR',
  criminal_record_check:   'Criminal Record Check',
  vulnerable_sector_check: 'Vulnerable Sector Check',
  drivers_license:         "Driver's License",
  child_access_check:      'Child Access Check',
  tb_test:                 'TB Test',
  immunization_record:     'Immunization Record',
  auto_insurance:          'Auto Insurance',
  work_permit:             'Work Permit',
  psw_certificate:         'PSW Certificate',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NotificationItem({ n }: { n: Notification }) {
  const { mutate: markRead }     = useMarkRead()
  const { mutate: markResolved, isPending: resolving } = useMarkResolved()
  const isUnread    = n.read_at === null
  const isResolved  = n.resolved_at !== null

  return (
    <div
      className={`border-b border-line-faint px-4 py-3 transition-colors ${
        isUnread ? 'bg-cream-2' : 'bg-paper'
      }`}
    >
      {/* Top row */}
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
          {isUnread && (
            <div className="h-2 w-2 shrink-0 rounded-full bg-orange" />
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="mt-2 flex items-center gap-3">
        {isUnread && (
          <button
            onClick={() => markRead(n.id)}
            className="font-mono text-[9px] uppercase tracking-wider text-ink-soft underline hover:text-ink"
          >
            Mark read
          </button>
        )}
        {n.requires_action && !isResolved && (
          <button
            onClick={() => markResolved(n.id)}
            disabled={resolving}
            className="font-mono text-[9px] uppercase tracking-wider text-orange underline hover:text-ink disabled:opacity-50"
          >
            {resolving ? 'Resolving…' : 'Mark resolved'}
          </button>
        )}
        {isResolved && (
          <span className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">
            ✓ Resolved
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data } = useNotifications()

  const unread         = data?.unread_count ?? 0
  const actionNeeded   = data?.action_needed_count ?? 0
  const notifications  = data?.notifications ?? []

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

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
              notifications.map((n) => <NotificationItem key={n.id} n={n} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
