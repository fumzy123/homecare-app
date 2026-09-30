/** Decorative brand mark; the adjacent wordmark supplies the accessible name. */
export function BoatLogo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M1 1h30v30H1z" stroke="currentColor" />
      <path d="M16 6v16M13 9 6 20h7M19 11l7 9h-7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m6 23 3 4h14l3-4H6Z" fill="currentColor" />
      <circle cx="25" cy="7" r="2.5" fill="#FF5A1F" />
    </svg>
  )
}
