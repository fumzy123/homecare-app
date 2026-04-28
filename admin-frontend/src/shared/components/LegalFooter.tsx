import { Link } from '@tanstack/react-router'

export function LegalFooter() {
  return (
    <div className="flex items-center gap-4 mt-8 font-mono text-[9px] tracking-[0.08em] uppercase text-muted">
      <Link to="/terms" className="hover:text-ink transition-colors">Terms</Link>
      <span>·</span>
      <Link to="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
      <span>·</span>
      <Link to="/dpa" className="hover:text-ink transition-colors">DPA</Link>
    </div>
  )
}
