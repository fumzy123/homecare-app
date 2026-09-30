import { Link } from '@tanstack/react-router'

// Layer 2: landing-page presentation and local UI interactions.
export function LandingFooter() {
  return (
    <footer className="wrap">
      <div className="footer-main">
        <a href="#" className="brand">
          <svg
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <path d="M1 1h30v30H1z" stroke="currentColor"></path>
            <path
              d="M8 24V10l8 9v-9l8 9v5"
              stroke="currentColor"
              strokeWidth="1.5"
            ></path>
            <circle cx="24" cy="7" r="2.5" fill="#FF5A1F"></circle>
          </svg>
          <span>
            Care Harbor<small>HOME CARE OS</small>
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
