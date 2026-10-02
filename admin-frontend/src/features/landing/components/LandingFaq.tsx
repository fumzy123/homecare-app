// Layer 2: landing-page presentation and local UI interactions.
export function LandingFaq() {
  return (
    <section className="faq wrap section-space" id="pricing-faq">
      <div className="faq-title">
        <div className="section-kicker">A LITTLE MORE CLARITY</div>
        <h2>
          Good questions.
          <br />
          <em>Straight answers.</em>
        </h2>
      </div>
      <div className="faq-list">
        <details>
          <summary>
            Who is Care Harbor designed for?<span>+</span>
          </summary>
          <p>
            Home care agencies whose office teams coordinate clients, home
            support workers, and recurring visits. This first release focuses on
            the agency administrator’s desktop workspace.
          </p>
        </details>
        <details>
          <summary>
            What does getting started look like?<span>+</span>
          </summary>
          <p>
            Personal onboarding and office training are included. Registry
            import covers up to 100 clients and 50 workers; migration scope is
            agreed first. Your 14-day trial starts when your agency account is
            created after email verification. Onboarding does not delay the
            trial. Subscribe during the trial and keep your remaining days. A
            card and billing consent are required to subscribe; your first
            payment is due when the trial ends, unless you cancel renewal. If
            you subscribe after the trial, payment is due immediately.
          </p>
        </details>
        <details>
          <summary>
            What counts as an active client?<span>+</span>
          </summary>
          <p>
            A client counts once if they have at least one qualifying scheduled
            or completed visit in the monthly billing period. Cancelled visits
            do not count; no-shows do. Your first monthly usage period starts
            when your paid subscription begins. For example, if paid service
            starts May 10, the next period starts June 10. We count active
            clients monthly even when you pay annually.
          </p>
        </details>
        <details id="annual-clients-faq">
          <summary>
            How are additional clients charged on the annual plan?<span>+</span>
          </summary>
          <p>
            You pay the $3,360 base upfront for your subscription year. It
            includes 10 active clients in each monthly billing period. Each
            month, we calculate $10 for every active client above 10. These
            monthly charges accumulate and are collected after your subscription
            year ends and its three-day correction window closes. Adding clients
            does not trigger an upfront charge for the remaining months.
          </p>
          <p>
            For example, suppose you have 10 active clients for the first eight
            months, then 20 in each of the last four months. Your additional
            charges are $0 for the first eight months, then{' '}
            <strong>$100 + $100 + $100 + $100 = $400 CAD</strong>. Your base plus
            additional-client charges for that year total $3,760 before tax. If
            your active-client count changes, each month's charge changes with
            it.
          </p>
          <p>
            When you renew, the previous year's additional-client charges are
            collected with the next year's base payment. If you cancel renewal,
            any final additional-client charges are still collected after your
            prepaid year and correction window end.
          </p>
          <p>
            A client counts once in a monthly period when they have at least one
            qualifying scheduled, in-progress, completed or no-show visit.
            Cancelled visits do not count. Creating a client profile alone does
            not incur a charge, and there is no daily proration. The card shows
            your annual base separately from the monthly additional-client
            estimate; the 20% saving applies only to the base.
          </p>
        </details>
        <details>
          <summary>
            Can workers check in from their phones?<span>+</span>
          </summary>
          <p>
            The worker mobile app and GPS check-in/out are on the roadmap.
            Today, attendance records are managed by office staff. A completed
            shift status does not prove attendance, and scheduled-hours exports
            should be reviewed before payroll.
          </p>
        </details>
        <details>
          <summary>
            Is there a founding customer offer?<span>+</span>
          </summary>
          <p>
            The founding offer starts at $200 CAD/month for 10 active clients,
            then $5 per additional client. It’s for the first three customers,
            subject to availability and approval, and includes a monthly
            30-minute session for honest feedback. Testimonials and logo use are requested after you have experienced value, are optional and
            require your written approval before publication. Rates are
            protected for the first 12 paid months, then Standard rates apply
            with at least 30 days’ notice.
          </p>
        </details>
        <details>
          <summary>
            Can I cancel?<span>+</span>
          </summary>
          <p>
            You can cancel renewal at any time from Billing. Monthly plans have
            no minimum commitment. You keep access until the end of the period
            you have paid for. Prepaid base fees are non-refundable, subject to
            applicable legal rights. Outstanding additional-client charges still
            apply. For annual plans, any final additional-client charges are
            invoiced after the prepaid year and its three-day correction window
            end. Service terms apply.
          </p>
        </details>
      </div>
    </section>
  )
}
