import { Link } from '@tanstack/react-router'

// Layer 2: landing-page presentation and local UI interactions.
export function LandingCallToAction({
  startPath,
}: {
  startPath: '/register' | '/dashboard'
}) {
  return (
    <section className="final-cta grid-paper" id="getting-started">
      <div className="wrap">
        <div className="section-kicker">THE NEXT CHAPTER STARTS HERE</div>
        <h2>
          Give your attention
          <br />
          back to <span className="highlight">care.</span>
        </h2>
        <p>
          A clearer week for your office.
          <br />A more connected foundation for your agency.
        </p>
        <Link className="button orange" to={startPath}>
          {startPath === '/dashboard' ? 'Go to dashboard' : 'Let’s get started'}{' '}
          <span aria-hidden="true">↗</span>
        </Link>
        <span className="cta-note">
          Personal onboarding. A real conversation.
        </span>
        <div className="closing-mark" aria-hidden="true">
          ↗
        </div>
      </div>
    </section>
  )
}
