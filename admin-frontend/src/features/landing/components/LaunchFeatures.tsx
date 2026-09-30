// Layer 2: landing-page presentation and local UI interactions.
export function LaunchFeatures() {
  return (
    <section className="scope wrap section-space">
      <div className="section-kicker">
        <span>03 / BUILT WITH INTENTION</span>
        <span className="short-rule"></span>
      </div>
      <div className="scope-layout">
        <div>
          <h2>
            A focused start.
            <br />
            <em>A clear way forward.</em>
          </h2>
          <p>
            Start with the work your office does every day. Know exactly what’s
            included, and what’s still ahead.
          </p>
        </div>
        <div className="scope-list">
          <div className="scope-row">
            <span className="pill">Included at launch</span>
            <h3>The agency workspace</h3>
            <ul className="launch-feature-list">
              <li>Shift Scheduling</li>
              <li>
                Client profile management{' '}
                <span>(Authorizations, Weekly care plans, Progress Notes)</span>
              </li>
              <li>
                Worker profile management{' '}
                <span>(Availability and Credentials)</span>
              </li>
              <li>Worker Time sheet export</li>
            </ul>
          </div>
          <div className="scope-row">
            <span className="pill roadmap-pill">On the roadmap</span>
            <h3>Care, out in the field</h3>
            <p>
              The worker mobile app, push notifications, and GPS visit
              verification are planned. They aren’t included today.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
