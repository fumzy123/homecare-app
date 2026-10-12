import { useEffect, useRef, useState } from 'react'

// Layer 2: contextual help with mouse, touch, and keyboard access.
export function PricingHelp() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return (
    <span
      className="client-help"
      ref={root}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setOpen(true)
      }}
      onPointerLeave={() => {
        if (!root.current?.contains(document.activeElement)) setOpen(false)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <label htmlFor="client-count">Active clients per month</label>
      <button
        type="button"
        className="client-help-button"
        aria-label="About active client pricing"
        aria-describedby="client-count-help"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6" />
          <circle cx="12" cy="7.5" r=".8" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <span id="client-count-help" role="tooltip" hidden={!open}>
        <span>
          Tell us how many active clients you serve each month to see your
          estimated cost. The first 10 clients are included.
        </span>
      </span>
    </span>
  )
}
