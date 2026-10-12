import { useState } from 'react'

// Layer 2: landing-page presentation and local UI interactions.
export function SchedulingDemo() {
  const [worker, setWorker] = useState('sarah')
  const [saved, setSaved] = useState(false)
  const available = worker === 'daniel'

  return (
    <section className="guardrails" id="scheduling-demo">
      <div className="wrap guardrail-layout">
        <div className="guardrail-copy">
          <div className="section-kicker">
            02 / DETAILS THAT MAKE A DIFFERENCE
          </div>
          <h2>
            A second pair
            <br />
            of eyes.
            <br />
            <em>Before you save.</em>
          </h2>
          <p>
            A busy week is a lot to hold in your head. Care Harbor flags
            overlapping visits before a worker ends up in two places at once.
          </p>
          <div className="try-note">
            <span aria-hidden="true">↳</span>
            <span>
              Try it yourself.
              <br />
              Choose a worker for this visit.
            </span>
          </div>
        </div>
        <div className="conflict-demo">
          <div className="demo-header">
            <span className="micro">NEW VISIT</span>
            <span className="micro">INTERACTIVE EXAMPLE</span>
          </div>
          <h3>Care for James Thompson</h3>
          <div className="visit-detail">
            <span>Monday, September 28</span>
            <b>09:00 – 11:00</b>
          </div>
          <label htmlFor="worker-select">Assign a worker</label>
          <select
            id="worker-select"
            value={worker}
            onChange={(event) => {
              setWorker(event.target.value)
              setSaved(false)
            }}
          >
            <option value="sarah">Sarah Collins</option>
            <option value="daniel">Daniel Chen</option>
          </select>
          <div
            id="conflict-result"
            className={`conflict-message${available ? ' success' : ''}`}
            aria-live="polite"
          >
            <span className="result-icon">{available ? '✓' : '!'}</span>
            <div>
              <b>
                {saved
                  ? 'That’s a better fit.'
                  : available
                    ? 'A clear space in the schedule.'
                    : 'This time is already spoken for.'}
              </b>
              <p>
                {saved
                  ? 'Example complete: James’s visit is assigned to Daniel. In Care Harbor, it would now appear on your schedule.'
                  : available
                    ? 'Daniel has no overlapping visits from 09:00 to 11:00. This visit is ready to schedule.'
                    : 'Sarah has a visit with Margaret from 08:00 to 11:00. Choose another worker or time.'}
              </p>
            </div>
          </div>
          <button
            id="save-visit"
            className="button demo-save"
            disabled={!available || saved}
            onClick={() => setSaved(true)}
          >
            {saved
              ? 'Example complete'
              : available
                ? 'Save example visit'
                : 'Resolve the conflict to save'}{' '}
            <span aria-hidden="true">{saved ? '✓' : '↗'}</span>
          </button>
          <p className="demo-disclaimer">
            Sample scenario. No real visits are created.
          </p>
        </div>
      </div>
    </section>
  )
}
