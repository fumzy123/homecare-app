import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'

// Layer 2: contextual help for a label, including keyboard and touch access.
export function HelpTooltip({ id, text, buttonLabel, children }: {
  id: string; text: string; buttonLabel: string; children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const dismissOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [open])

  return <span ref={root} className="relative inline-flex items-center gap-1"
    onPointerEnter={event => { if (event.pointerType === 'mouse') setOpen(true) }}
    onPointerLeave={() => { if (!root.current?.contains(document.activeElement)) setOpen(false) }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    {children}
    <button type="button" aria-label={buttonLabel} aria-describedby={id}
      onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
      className="inline-flex size-8 shrink-0 items-center justify-center text-cream/70 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange">
      <Info size={15} aria-hidden="true" />
    </button>
    <span id={id} role="tooltip" hidden={!open} className="absolute bottom-full left-0 z-10 w-56 max-w-[calc(100vw_-_4rem)] pb-2 sm:bottom-auto sm:left-full sm:top-1/2 sm:-translate-y-1/2 sm:pb-0 sm:pl-2">
      <span className="block border border-cream/40 bg-paper px-3 py-2 text-xs leading-relaxed text-ink shadow-lg">{text}</span>
    </span>
  </span>
}
