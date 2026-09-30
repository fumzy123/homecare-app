import type { PreviewView } from '../types'

// Layer 2: landing-page presentation and local UI interactions.
export function FeatureOverview({
  onExplore,
}: {
  onExplore: (view: PreviewView) => void
}) {
  return (
    <section className="overview wrap section-space" id="difference">
      <div className="section-kicker">
        <span>01 / THE BIG PICTURE</span>
        <span className="short-rule"></span>
      </div>
      <div className="section-intro">
        <h2>
          Care is personal.
          <br />
          <em>
            The admin shouldn’t
            <br />
            take all your time.
          </em>
        </h2>
        <div>
          <p>
            Behind every visit is a chain of details. A client’s needs. A
            worker’s availability. A change to next Tuesday.
          </p>
          <p>
            Care Harbor brings that work into one place, so your office can plan
            with context and respond with clarity.
          </p>
        </div>
      </div>
      <div className="feature-grid">
        <article className="feature-card">
          <div className="mini-plan">
            <div className="mini-card-label">
              MARGARET’S CARE PLAN <span>↗</span>
            </div>
            <div className="week-chips">
              <span className="filled">M</span>
              <span>T</span>
              <span className="filled">W</span>
              <span>T</span>
              <span className="filled">F</span>
            </div>
            <div className="mini-progress">
              <span></span>
            </div>
            <div className="mini-meta">
              <span>18 / 24 bi-weekly hours</span>
              <b>Within cap ✓</b>
            </div>
          </div>
          <div className="feature-copy">
            <span className="micro">CLIENTS &amp; CARE PLANS</span>
            <h3>
              A plan with the
              <br />
              whole person in mind.
            </h3>
            <p>
              Keep client details, authorized hours, and recurring care
              together. Build the week from what each client needs.
            </p>
            <button
              className="inline-link"
              onClick={() => onExplore('clients')}
            >
              Explore care plans <span>↗</span>
            </button>
          </div>
        </article>
        <article className="feature-card">
          <div className="mini-schedule">
            <div className="mini-card-label">
              A WEEK THAT FITS <span>↗</span>
            </div>
            <div className="schedule-bars">
              <div>
                <span>MON</span>
                <i className="bar-mint"></i>
                <i className="bar-peach"></i>
              </div>
              <div>
                <span>TUE</span>
                <i className="bar-lavender"></i>
              </div>
              <div>
                <span>WED</span>
                <i className="bar-mint"></i>
                <i className="bar-short"></i>
              </div>
            </div>
          </div>
          <div className="feature-copy">
            <span className="micro">VISUAL SCHEDULING</span>
            <h3>
              Make a clear plan.
              <br />
              Leave room for life.
            </h3>
            <p>
              Set up recurring visits, see your week at a glance, and handle
              changes without rebuilding the whole schedule.
            </p>
            <button
              className="inline-link"
              onClick={() => onExplore('schedule')}
            >
              Explore scheduling <span>↗</span>
            </button>
          </div>
        </article>
        <article className="feature-card">
          <div className="mini-team">
            <div className="mini-card-label">
              THE RIGHT CONTEXT <span>↗</span>
            </div>
            <div className="mini-worker">
              <span className="avatar mint-avatar">SC</span>
              <div>
                <b>Sarah Collins</b>
                <small>Home support worker</small>
              </div>
              <span>↗</span>
            </div>
            <div className="mini-worker-tags">
              <span>Availability</span>
              <span>Credentials</span>
              <span>Leave</span>
            </div>
          </div>
          <div className="feature-copy">
            <span className="micro">WORKER MANAGEMENT</span>
            <h3>
              Know your people.
              <br />
              Plan around them.
            </h3>
            <p>
              Bring worker profiles, availability, credentials, and leave into
              the same workspace as your care schedule.
            </p>
            <button className="inline-link" onClick={() => onExplore('team')}>
              Explore your team <span>↗</span>
            </button>
          </div>
        </article>
      </div>
    </section>
  )
}
