import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/terms')({
  component: TermsPage,
})

const EFFECTIVE_DATE = 'May 1, 2026'
const VERSION = '0.0'

function TermsPage() {
  return (
    <div className="min-h-screen bg-cream">
      <LegalNav />
      <div className="max-w-3xl mx-auto px-8 py-16">

        <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mb-4">
          Legal · Version {VERSION} · Effective {EFFECTIVE_DATE}
        </p>
        <h1 className="font-serif text-[48px] leading-[1.0] font-medium tracking-[-0.02em] mb-2">
          Terms of Service
        </h1>
        <p className="font-mono text-[12px] text-ink-soft mb-12 leading-relaxed">
          Please read these Terms carefully before using the Homecare platform. By accessing or
          using the platform, your organisation agrees to be bound by these Terms.
        </p>

        <hr className="border-ink mb-12" />

        <Section number="1" title="Definitions">
          <p><strong>"Platform"</strong> means the Homecare web application and related services.</p>
          <p><strong>"Agency"</strong> or <strong>"you"</strong> means the home care organisation that has registered an account.</p>
          <p><strong>"Provider"</strong> or <strong>"we"</strong> means [YOUR COMPANY LEGAL NAME], the operator of the Platform.</p>
          <p><strong>"Users"</strong> means the Agency's administrators and staff who access the Platform.</p>
          <Placeholder>Add definitions for any other key terms your lawyer identifies.</Placeholder>
        </Section>

        <Section number="2" title="Acceptance of Terms">
          <p>
            By registering an account or accessing the Platform, the Agency acknowledges that it has read,
            understood, and agrees to be bound by these Terms and our Privacy Policy. If you are entering
            into these Terms on behalf of an organisation, you represent that you have authority to bind
            that organisation.
          </p>
        </Section>

        <Section number="3" title="Permitted Use">
          <p>The Platform is licensed, not sold, to the Agency for internal business operations only. The Agency agrees not to:</p>
          <ul>
            <li>Resell, sublicense, or transfer access to the Platform to any third party</li>
            <li>Use the Platform for any unlawful purpose</li>
            <li>Attempt to reverse-engineer or extract source code from the Platform</li>
            <li>Use the Platform to store or transmit malicious code</li>
          </ul>
          <Placeholder>Your lawyer may want to expand the prohibited use list based on your specific risk profile.</Placeholder>
        </Section>

        <Section number="4" title="Subscription and Payment">
          <Placeholder>
            Detail your pricing model here: subscription tiers, billing cycles, payment methods accepted,
            what happens on non-payment (grace period, suspension, termination), refund policy, and
            how price changes are communicated.
          </Placeholder>
        </Section>

        <Section number="5" title="Data and Privacy">
          <p>
            The Platform processes personal data belonging to the Agency's clients and workers. This processing
            is governed by our <Link to="/privacy" className="underline underline-offset-2 hover:text-orange">Privacy Policy</Link> and,
            where applicable, the <Link to="/dpa" className="underline underline-offset-2 hover:text-orange">Data Processing Agreement</Link>.
          </p>
          <p>
            The Agency is responsible for ensuring it has a lawful basis to provide personal data to the Platform
            and that its own clients and workers have been informed of such processing.
          </p>
        </Section>

        <Section number="6" title="Service Availability and Uptime">
          <Placeholder>
            Specify your SLA: target uptime percentage, scheduled maintenance windows, how downtime is communicated,
            and any credits or remedies for extended outages.
          </Placeholder>
        </Section>

        <Section number="7" title="Intellectual Property">
          <p>
            The Platform, including all software, design, and content, is owned by the Provider and protected
            by copyright and other intellectual property laws. These Terms do not grant the Agency any ownership
            interest in the Platform.
          </p>
          <p>
            The Agency retains ownership of all data it uploads to the Platform. The Provider is granted a
            limited licence to process that data solely to provide the service.
          </p>
        </Section>

        <Section number="8" title="Confidentiality">
          <Placeholder>
            Define what constitutes confidential information for both parties, the obligation to protect it,
            and the duration of the confidentiality obligation after termination.
          </Placeholder>
        </Section>

        <Section number="9" title="Limitation of Liability">
          <Placeholder>
            This is one of the most important clauses — have your lawyer draft this carefully. It should address:
            exclusion of consequential/indirect damages, liability cap (e.g., fees paid in the prior 12 months),
            and any carve-outs (e.g., for gross negligence or wilful misconduct).
          </Placeholder>
        </Section>

        <Section number="10" title="Termination">
          <Placeholder>
            Specify: how either party can terminate (notice period), what happens to data after termination
            (export window, deletion timeline), and which clauses survive termination.
          </Placeholder>
        </Section>

        <Section number="11" title="Governing Law and Dispute Resolution">
          <Placeholder>
            Specify the governing jurisdiction (e.g., Province of Ontario, Canada), and your preferred
            dispute resolution process (negotiation → mediation → arbitration or litigation).
          </Placeholder>
        </Section>

        <Section number="12" title="Changes to These Terms">
          <p>
            We may update these Terms from time to time. We will notify Agencies of material changes by
            email and by requiring re-acceptance within the Platform before continued use. The version
            number and effective date at the top of this page will always reflect the current Terms.
          </p>
        </Section>

        <Section number="13" title="Contact">
          <Placeholder>
            Provide a legal contact address (name, email, mailing address) for notices under these Terms.
          </Placeholder>
        </Section>

        <hr className="border-ink mt-12 mb-8" />
        <p className="font-mono text-[10px] text-muted tracking-[0.08em] uppercase">
          Homecare · Terms of Service · Version {VERSION} · {EFFECTIVE_DATE}
        </p>
      </div>
    </div>
  )
}

function LegalNav() {
  return (
    <div className="border-b border-ink px-8 py-4 flex items-center justify-between bg-paper">
      <Link to="/login" className="flex items-center gap-3 group">
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <rect x="0.5" y="0.5" width="27" height="27" stroke="#111" />
          <path d="M 7 21 L 7 9 L 14 17 L 14 9 L 21 17 L 21 21" stroke="#111" strokeWidth="1.5" fill="none" />
          <circle cx="21" cy="7" r="2.5" fill="#FF5A1F" />
        </svg>
        <span className="font-serif text-[16px] leading-none tracking-[-0.02em] font-medium">Homecare</span>
      </Link>
      <div className="flex items-center gap-6 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft">
        <Link to="/terms" className="hover:text-ink transition-colors [&.active]:text-ink [&.active]:underline underline-offset-4">Terms</Link>
        <Link to="/privacy" className="hover:text-ink transition-colors [&.active]:text-ink [&.active]:underline underline-offset-4">Privacy</Link>
        <Link to="/dpa" className="hover:text-ink transition-colors [&.active]:text-ink [&.active]:underline underline-offset-4">DPA</Link>
      </div>
    </div>
  )
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="font-serif text-[22px] font-medium tracking-[-0.01em] mb-4">
        <span className="font-mono text-[12px] text-ink-soft mr-3">{number}.</span>
        {title}
      </h2>
      <div className="font-mono text-[12px] text-ink leading-relaxed space-y-3 pl-6">
        {children}
      </div>
    </div>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-orange/60 bg-orange/5 px-4 py-3 text-orange text-[11px] leading-relaxed">
      <span className="font-semibold uppercase tracking-[0.08em] block mb-1">⚠ Lawyer review needed</span>
      {children}
    </div>
  )
}
