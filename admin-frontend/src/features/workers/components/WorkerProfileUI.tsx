import { useEffect, useId, useRef, type ReactNode } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import type { ShiftOccurrence } from '@/features/shifts/api'
import { ShiftStatusBadge } from '@/shared/components/ui'
import { dateLabel, timeLabel } from '../lib/profile'

// Layer 2: controlled presentation only.
export function WorkerLoading({
  error,
  retry,
  refresh = false,
}: {
  error?: boolean
  retry?: () => void
  refresh?: boolean
}) {
  return (
    <div className="wp-empty" role={error ? 'alert' : 'status'}>
      {error ? (
        <>
          {refresh
            ? 'Couldn’t refresh this information. Showing the last loaded details.'
            : 'Couldn’t load this information.'}{' '}
          {retry && (
            <button className="wp-link" onClick={retry}>
              Try again
            </button>
          )}
        </>
      ) : (
        'Loading…'
      )}
    </div>
  )
}
export function WorkerPanel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="wp-panel">
      <header className="wp-panel-heading">
        <h3>{title}</h3>
        {action}
      </header>
      <div className="wp-panel-body">{children}</div>
    </section>
  )
}
export function WorkerDialog({
  title,
  subtitle,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId()
  useEffect(() => {
    const dialog = ref.current!,
      previous = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`worker-workspace wp-dialog${wide ? ' wp-dialog-wide' : ''}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!busy) onClose()
      }}
    >
      <header className="wp-panel-heading">
        <div>
          {subtitle && <p className="wp-label">{subtitle}</p>}
          <h2 id={id}>{title}</h2>
        </div>
        <button
          className="wp-icon"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </header>
      <div className="wp-dialog-body">{children}</div>
    </dialog>
  )
}
export function WorkerVisitRow({
  visit,
  onSelect,
  today,
  showStatus = false,
}: {
  visit: ShiftOccurrence
  onSelect: () => void
  today?: string
  showStatus?: boolean
}) {
  const date = visit.start_time.slice(0, 10),
    endDate = visit.end_time.slice(0, 10)
  return (
    <button className="wp-visit" onClick={onSelect}>
      <span className="wp-visit-date">
        <small>{date === today ? 'Today' : dateLabel(date, 'EEE')}</small>
        {dateLabel(date, 'dd')}
      </span>
      <span>
        <span className="wp-visit-name">
          {visit.client.first_name} {visit.client.last_name}
        </span>
        <span className="wp-muted">
          {timeLabel(visit.start_time.slice(11))}–
          {date !== endDate ? `${dateLabel(endDate, 'MMM d')} ` : ''}
          {timeLabel(visit.end_time.slice(11))}
        </span>
      </span>
      {showStatus ? (
        <ShiftStatusBadge status={visit.completion_status} />
      ) : (
        <ArrowUpRight size={16} />
      )}
    </button>
  )
}
