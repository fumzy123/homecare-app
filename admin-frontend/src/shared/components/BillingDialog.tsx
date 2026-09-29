import { useEffect, useId, useRef, type ReactNode } from 'react'

// Layer 2: native modal supplies focus trapping, Escape, and focus restoration.
export function BillingDialog({ title, busy = false, onClose, children }: {
  title: string; busy?: boolean; onClose: () => void; children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return <dialog ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}
    className="m-auto w-[calc(100%_-_2rem)] max-w-xl max-h-[90vh] overflow-y-auto border border-ink bg-paper p-6 text-ink shadow-xl backdrop:bg-ink/40 sm:p-8">
    <div className="-mx-6 -mt-6 mb-6 flex items-center justify-between gap-4 border-b border-ink px-6 py-4 sm:-mx-8 sm:-mt-8 sm:px-8"><h2 id={id} className="font-serif text-[24px] font-medium">{title}</h2>
      <button type="button" aria-label="Close" disabled={busy} onClick={onClose} className="px-3 py-1 text-2xl disabled:opacity-40">×</button></div>
    {children}
  </dialog>
}
