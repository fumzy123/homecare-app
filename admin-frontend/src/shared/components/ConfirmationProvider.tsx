import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ConfirmationContext, type ConfirmationOptions } from './confirmation'
import './confirmation.css'

// Layer 2: presentation and local interaction; callers own all domain mutations.
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null)
  const pending = useRef<((value: boolean) => void) | null>(null)
  const confirm = useCallback((next: ConfirmationOptions) => {
    // Repeated clicks must not schedule a second action behind this dialog.
    if (pending.current) return Promise.resolve(false)
    return new Promise<boolean>(resolve => {
      pending.current = resolve
      setOptions(next)
    })
  }, [])
  const settle = useCallback((value: boolean) => {
    const resolve = pending.current
    pending.current = null
    setOptions(null)
    resolve?.(value)
  }, [])
  useEffect(() => () => { pending.current?.(false); pending.current = null }, [])
  return <ConfirmationContext.Provider value={confirm}>
    {children}
    {options && <ConfirmationDialog options={options} settle={settle} />}
  </ConfirmationContext.Provider>
}

function ConfirmationDialog({ options, settle }: { options: ConfirmationOptions; settle: (value: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  const active = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement
    dialog.showModal()
    dialog.querySelector<HTMLButtonElement>('[data-keep]')?.focus()
    return () => {
      dialog.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  async function accept() {
    if (active.current) return
    active.current = true
    setBusy(true)
    setError('')
    try {
      await options.onConfirm?.()
      settle(true)
    } catch {
      setError('We could not confirm the result. Check the record before trying again. Your changes remain here.')
    } finally {
      active.current = false
      setBusy(false)
    }
  }
  return <dialog ref={ref} className="app-confirm" aria-labelledby={id} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!active.current) settle(false) }}
    onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation() }}>
    <header><h2 id={id}>{options.title}</h2><button type="button" aria-label="Close confirmation" disabled={busy} onClick={() => settle(false)}><X size={20} /></button></header>
    <div className="app-confirm-body">
      <p id={`${id}-description`}>{options.description ?? 'Your unsaved changes will be discarded.'}</p>
      {error && <p role="alert" className="app-confirm-error">{error}</p>}
    </div>
    <footer>
      <button type="button" data-keep disabled={busy} onClick={() => settle(false)}>{options.cancelLabel ?? 'Keep editing'}</button>
      <button type="button" className="app-confirm-action" disabled={busy} onClick={() => void accept()}>{busy ? 'Please wait…' : options.confirmLabel ?? 'Discard and close'}</button>
    </footer>
  </dialog>
}
