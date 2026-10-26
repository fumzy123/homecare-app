import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import '../visit-drawers.css'

// Layer 2: shared presentation and native modal focus handling, no data fetching.
export function VisitDrawer({ title, subtitle, children, action, onClose, busy = false, compact = false }: {
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
  onClose: () => void
  busy?: boolean
  compact?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    return () => {
      dialog.close()
      // React may remove the dialog before the browser restores its opener.
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  return (
    <dialog ref={ref} className={`vd-dialog${compact ? ' vd-compact' : ''}`} aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); if (!busy) onClose() }}
      onClick={event => {
        if (event.target !== event.currentTarget || busy) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
      }}>
      <header className="vd-header">
        <div><p className="vd-kicker">{compact ? 'Recurring care' : 'Scheduled care'}</p><h2 id={titleId}>{title}</h2>{subtitle && <p className="vd-subtitle">{subtitle}</p>}</div>
        <div className="vd-header-actions">{action}<button type="button" className="vd-close" aria-label={`Close ${title.toLowerCase()}`} disabled={busy} onClick={onClose}><X size={20} /></button></div>
      </header>
      {children}
    </dialog>
  )
}

export function VisitFormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = useId()
  return <section className="vd-section" aria-labelledby={id}><div className="vd-section-heading"><h3 id={id}>{title}</h3>{description && <p>{description}</p>}</div><div className="vd-section-fields">{children}</div></section>
}
