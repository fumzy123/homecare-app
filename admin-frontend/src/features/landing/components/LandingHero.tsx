import { WorkspacePreview } from './WorkspacePreview'
import type { PreviewView } from '../types'

// Layer 2: landing-page presentation and local UI interactions.
export function LandingHero({
  view,
  onViewChange,
  onAddShift,
}: {
  view: PreviewView
  onViewChange: (view: PreviewView) => void
  onAddShift: () => void
}) {
  return (
    <section className="hero grid-paper">
      <div className="hero-margin left" aria-hidden="true">
        PURPOSE-BUILT FOR HOME CARE
      </div>
      <div className="hero-margin right" aria-hidden="true">
        PEOPLE FIRST. DETAILS HANDLED.
      </div>
      <div className="hero-copy">
        <a href="#getting-started" className="announcement">
          <span className="status-dot"></span> A new chapter for your agency{' '}
          <span aria-hidden="true">↗</span>
        </a>
        <h1>
          <span className="hero-headline-line">Schedule care</span>{' '}
          <span className="hero-headline-line">
            without the <span className="highlight">paperwork.</span>
          </span>
        </h1>
        <p>
          Bring your schedules, client, and care team together in one place—so
          your care team can plan the week and handle changes with confidence.
        </p>
        <div className="hero-actions">
          <a className="button orange" href="#workspace">
            Explore the workspace <span aria-hidden="true">↓</span>
          </a>
          <a className="text-link" href="#pricing">
            Find your plan <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="hero-note">
          <span>Built for agency admins</span>
          <i>·</i>
          <span>Personal onboarding included</span>
        </div>
      </div>
      <WorkspacePreview
        view={view}
        onViewChange={onViewChange}
        onAddShift={onAddShift}
      />
    </section>
  )
}
