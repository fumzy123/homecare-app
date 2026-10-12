import { BoatLogo } from '@/shared/components/ui/BoatLogo'
import { Link } from '@tanstack/react-router'

// Layer 2: landing-page presentation and local UI interactions.
export function LandingFooter() {
  return (
    <footer className="wrap">
      <div className="footer-main">
        <a href="#" className="brand">
          <BoatLogo size={28} />
          <span>
            Care Harbor
          </span>
        </a>
        <p>For the people behind the care.</p>
        <a href="#main">Back to the top ↑</a>
      </div>
      <div className="footer-meta">
        <span>© {new Date().getFullYear()} Care Harbor</span>
        <nav className="footer-legal" aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/dpa">Data processing</Link>
        </nav>
        <span>Illustrative workspace · Fictional sample data</span>
      </div>
    </footer>
  )
}
