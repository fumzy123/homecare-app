import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import '../client-workspace.css'

export function ClientPanel({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`cw-panel ${className}`}>
      <header className="cw-panel-heading">
        <h3>{title}</h3>
        {action}
      </header>
      {children}
    </section>
  )
}
export function ClientEmpty({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="cw-empty">
      <h3>{title}</h3>
      {children && <div className="cw-muted mt-3">{children}</div>}
    </div>
  )
}
export function ClientLoading({
  error = false,
  retry,
}: {
  error?: boolean
  retry?: () => void
}) {
  return (
    <div className="cw-empty" role={error ? 'alert' : 'status'}>
      {error ? (
        <>
          Couldn't load this information.{' '}
          {retry && (
            <button className="cw-link" onClick={retry}>
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
export function ClientBadge({
  children,
  tone = '',
}: {
  children: ReactNode
  tone?: string
}) {
  return (
    <span className={`cw-badge ${tone ? `cw-${tone}` : ''}`}>{children}</span>
  )
}
// Layer 2: native dialog provides focus containment, Escape and focus restoration.
export function ClientDialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`cw-dialog client-workspace ${wide ? 'cw-dialog-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <header className="cw-panel-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="cw-icon" aria-label="Close dialog" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="cw-dialog-content">{children}</div>
    </dialog>
  )
}
