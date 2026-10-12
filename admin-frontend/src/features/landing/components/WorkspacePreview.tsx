import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { PreviewView } from '../types'

// Layer 2: landing-page presentation and local UI interactions.
export function WorkspacePreview({
  view,
  onViewChange,
  onAddShift,
}: {
  view: PreviewView
  onViewChange: (view: PreviewView) => void
  onAddShift: () => void
}) {
  const [horizontalTabs, setHorizontalTabs] = useState(
    () => window.matchMedia('(max-width: 800px)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(max-width: 800px)')
    const update = (event: MediaQueryListEvent) => setHorizontalTabs(event.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  function handleTabKey(
    event: KeyboardEvent<HTMLButtonElement>,
    current: PreviewView,
  ) {
    const views: PreviewView[] = ['schedule', 'clients', 'team']
    const index = views.indexOf(current)
    let next: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % views.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index + views.length - 1) % views.length
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = views.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    onViewChange(views[next])
    document.getElementById(`tab-${views[next]}`)?.focus()
  }

  return (
    <div className="product-stage" id="workspace">
      <div className="stage-label">
        <span>
          <span className="status-dot"></span> YOUR AGENCY, IN VIEW
        </span>
        <span>INTERACTIVE PREVIEW · SAMPLE DATA</span>
      </div>
      <div className="workspace-frame">
        <aside className="app-sidebar" aria-label="Preview navigation">
          <div className="sample-agency">
            <span className="agency-icon">H</span>
            <div>
              Harbour Home Care<small>Agency workspace</small>
            </div>
          </div>
          <div className="sidebar-label">WORKSPACE</div>
          <div
            className="app-tabs"
            role="tablist"
            aria-orientation={horizontalTabs ? 'horizontal' : 'vertical'}
            aria-label="Explore the workspace"
          >
            <button
              role="tab"
              id="tab-schedule"
              aria-controls="panel-schedule"
              aria-selected={view === 'schedule'}
              tabIndex={view === 'schedule' ? 0 : -1}
              onClick={() => onViewChange('schedule')}
              onKeyDown={(event) => handleTabKey(event, 'schedule')}
            >
              <span aria-hidden="true">▦</span> Schedule{' '}
              <span className="tab-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
            <button
              role="tab"
              id="tab-clients"
              aria-controls="panel-clients"
              aria-selected={view === 'clients'}
              tabIndex={view === 'clients' ? 0 : -1}
              onClick={() => onViewChange('clients')}
              onKeyDown={(event) => handleTabKey(event, 'clients')}
            >
              <span aria-hidden="true">◎</span> Care needs{' '}
              <span className="tab-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
            <button
              role="tab"
              id="tab-team"
              aria-controls="panel-team"
              aria-selected={view === 'team'}
              tabIndex={view === 'team' ? 0 : -1}
              onClick={() => onViewChange('team')}
              onKeyDown={(event) => handleTabKey(event, 'team')}
            >
              <span aria-hidden="true">♧</span> Your team{' '}
              <span className="tab-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          </div>
          <div className="sidebar-bottom">
            <span className="avatar orange-avatar">AL</span>
            <span>
              Alex Lee<small>Agency administrator</small>
            </span>
          </div>
        </aside>
        <div className="app-content">
          <section
            id="panel-schedule"
            role="tabpanel"
            aria-labelledby="tab-schedule"
            tabIndex={0}
            hidden={view !== 'schedule'}
          >
            <div className="app-eyebrow">
              <span>01 / YOUR WEEK AT A GLANCE</span>
              <span className="outline-tag">SAMPLE WORKSPACE</span>
            </div>
            <div className="app-heading">
              <h2>
                A little more <em>in sync.</em>
              </h2>
              <button
                className="app-button"
                id="add-shift"
                onClick={onAddShift}
              >
                + Try adding a shift
              </button>
            </div>
            <div className="calendar-toolbar">
              <span>September 28 – October 2, 2026</span>
              <span className="legend">
                <i></i> Scheduled visits
              </span>
            </div>
            <div className="calendar-scroll">
              <div className="calendar" aria-label="Example weekly schedule">
                <div className="calendar-head">
                  <span></span>
                  <span>
                    MON <b>28</b>
                  </span>
                  <span className="today">
                    TUE <b>29</b>
                  </span>
                  <span>
                    WED <b>30</b>
                  </span>
                  <span>
                    THU <b>01</b>
                  </span>
                  <span>
                    FRI <b>02</b>
                  </span>
                </div>
                <div className="calendar-body">
                  <div className="time-labels">
                    <span>08:00</span>
                    <span>10:00</span>
                    <span>12:00</span>
                    <span>14:00</span>
                    <span>16:00</span>
                  </div>
                  <div className="day-column">
                    <div
                      className="visit mint-visit"
                      style={
                        { '--start': '0', '--length': '1.5' } as CSSProperties
                      }
                    >
                      <small>08:00 – 11:00</small>
                      <strong>Margaret W.</strong>
                      <span>Sarah Collins</span>
                    </div>
                    <div
                      className="visit peach-visit"
                      style={
                        { '--start': '2', '--length': '1.2' } as CSSProperties
                      }
                    >
                      <small>12:00 – 14:30</small>
                      <strong>James T.</strong>
                      <span>Daniel Chen</span>
                    </div>
                  </div>
                  <div className="day-column current">
                    <div
                      className="visit peach-visit"
                      style={
                        { '--start': '.5', '--length': '1.4' } as CSSProperties
                      }
                    >
                      <small>09:00 – 12:00</small>
                      <strong>Robert H.</strong>
                      <span>Daniel Chen</span>
                    </div>
                    <div
                      className="visit lavender-visit"
                      style={
                        {
                          '--start': '2.5',
                          '--length': '1.25',
                        } as CSSProperties
                      }
                    >
                      <small>13:00 – 15:30</small>
                      <strong>Evelyn B.</strong>
                      <span>Amira Patel</span>
                    </div>
                  </div>
                  <div className="day-column">
                    <div
                      className="visit mint-visit"
                      style={
                        { '--start': '0', '--length': '1.5' } as CSSProperties
                      }
                    >
                      <small>08:00 – 11:00</small>
                      <strong>Margaret W.</strong>
                      <span>Sarah Collins</span>
                    </div>
                    <div
                      className="open-visit"
                      style={{ '--start': '2.2' } as CSSProperties}
                    >
                      Room for the
                      <br />
                      unexpected.
                    </div>
                  </div>
                  <div className="day-column">
                    <div
                      className="visit lavender-visit"
                      style={
                        { '--start': '.5', '--length': '1.4' } as CSSProperties
                      }
                    >
                      <small>09:00 – 12:00</small>
                      <strong>Evelyn B.</strong>
                      <span>Amira Patel</span>
                    </div>
                    <div
                      className="visit peach-visit"
                      style={
                        {
                          '--start': '2.5',
                          '--length': '1.25',
                        } as CSSProperties
                      }
                    >
                      <small>13:00 – 15:30</small>
                      <strong>James T.</strong>
                      <span>Daniel Chen</span>
                    </div>
                  </div>
                  <div className="day-column">
                    <div
                      className="visit mint-visit"
                      style={
                        { '--start': '0', '--length': '1.5' } as CSSProperties
                      }
                    >
                      <small>08:00 – 11:00</small>
                      <strong>Margaret W.</strong>
                      <span>Sarah Collins</span>
                    </div>
                    <div
                      className="visit peach-visit"
                      style={
                        { '--start': '2', '--length': '1.2' } as CSSProperties
                      }
                    >
                      <small>12:00 – 14:30</small>
                      <strong>Robert H.</strong>
                      <span>Daniel Chen</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section
            id="panel-clients"
            role="tabpanel"
            aria-labelledby="tab-clients"
            tabIndex={0}
            hidden={view !== 'clients'}
          >
            <div className="app-eyebrow">
              <span>02 / CARE WITH CONTEXT</span>
              <span className="outline-tag">SAMPLE WORKSPACE</span>
            </div>
            <div className="app-heading">
              <h2>
                Every detail. <em>Connected.</em>
              </h2>
              <span className="app-button static">Weekly care need</span>
            </div>
            <div className="client-profile">
              <span className="avatar large mint-avatar">MW</span>
              <div>
                <h3>Margaret Wilson</h3>
                <p>Funded care · Active client</p>
              </div>
              <span className="pill">Within cap ✓</span>
            </div>
            <div className="plan-summary">
              <div>
                <span className="micro">AUTHORIZED / BI-WEEKLY</span>
                <strong>
                  24 <small>hours</small>
                </strong>
              </div>
              <div>
                <span className="micro">PLANNED / WEEKLY</span>
                <strong>
                  9 <small>hours</small>
                </strong>
              </div>
              <div>
                <span className="micro">BI-WEEKLY EQUIVALENT</span>
                <strong>
                  18 <small>of 24 hours</small>
                </strong>
              </div>
            </div>
            <div className="plan-table">
              <div>
                <span>DAY</span>
                <span>TIME</span>
                <span>SERVICE</span>
                <span>HOURS</span>
              </div>
              <div>
                <b>Monday</b>
                <span>08:00 – 11:00</span>
                <span>Personal care</span>
                <span>3h</span>
              </div>
              <div>
                <b>Wednesday</b>
                <span>08:00 – 11:00</span>
                <span>Personal care</span>
                <span>3h</span>
              </div>
              <div>
                <b>Friday</b>
                <span>08:00 – 11:00</span>
                <span>Personal care</span>
                <span>3h</span>
              </div>
            </div>
            <p className="panel-footnote">
              Weekly plans are checked against authorized hours before saving.
            </p>
          </section>
          <section
            id="panel-team"
            role="tabpanel"
            aria-labelledby="tab-team"
            tabIndex={0}
            hidden={view !== 'team'}
          >
            <div className="app-eyebrow">
              <span>03 / THE PEOPLE BEHIND THE CARE</span>
              <span className="outline-tag">SAMPLE WORKSPACE</span>
            </div>
            <div className="app-heading">
              <h2>
                Your team. <em>In the picture.</em>
              </h2>
              <span className="app-button static">Worker profiles</span>
            </div>
            <div className="team-preview">
              <article>
                <span className="avatar large mint-avatar">SC</span>
                <h3>Sarah Collins</h3>
                <p>Home support worker</p>
                <div className="worker-line">
                  <span>Availability</span>
                  <b>Mon · Wed · Fri</b>
                </div>
                <div className="worker-line">
                  <span>Weekly hours limit</span>
                  <b>30 hours</b>
                </div>
                <div className="worker-line">
                  <span>First aid</span>
                  <span className="pill">On file</span>
                </div>
              </article>
              <article>
                <span className="avatar large peach-avatar">DC</span>
                <h3>Daniel Chen</h3>
                <p>Home support worker</p>
                <div className="worker-line">
                  <span>Availability</span>
                  <b>Mon – Fri</b>
                </div>
                <div className="worker-line">
                  <span>Weekly hours limit</span>
                  <b>35 hours</b>
                </div>
                <div className="worker-line">
                  <span>First aid</span>
                  <span className="pill">On file</span>
                </div>
              </article>
              <article>
                <span className="avatar large lavender-avatar">AP</span>
                <h3>Amira Patel</h3>
                <p>Home support worker</p>
                <div className="worker-line">
                  <span>Availability</span>
                  <b>Tue · Thu · Fri</b>
                </div>
                <div className="worker-line">
                  <span>Weekly hours limit</span>
                  <b>24 hours</b>
                </div>
                <div className="worker-line">
                  <span>First aid</span>
                  <span className="pill yellow-pill">Review expiry</span>
                </div>
              </article>
            </div>
            <p className="panel-footnote">
              Profiles, recurring availability, and credentials in one place.
            </p>
          </section>
        </div>
      </div>
      <div className="preview-caption">
        <span>
          Less piecing things together. More seeing the whole picture.
        </span>
        <span className="micro">CLICK A TAB TO EXPLORE ↗</span>
      </div>
    </div>
  )
}
