// Layer 2: landing-page presentation and local UI interactions.
export function LandingPrinciples() {
  return (
    <section className="principles wrap" aria-label="Designed around your work">
      <div>
        <span className="principle-icon">01</span>
        <p>
          <b>Made for home care</b>
          <span>Built around clients, visits, and people.</span>
        </p>
      </div>
      <div>
        <span className="principle-icon">02</span>
        <p>
          <b>One connected workspace</b>
          <span>From the care need to the calendar.</span>
        </p>
      </div>
      <div>
        <span className="principle-icon">03</span>
        <p>
          <b>A human start</b>
          <span>Personal onboarding. No setup fees.</span>
        </p>
      </div>
    </section>
  )
}
