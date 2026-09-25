import { createFileRoute, Link } from '@tanstack/react-router'
import { CURRENT_TERMS_VERSION } from '@/shared/lib/legal'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
})

const EFFECTIVE_DATE = 'Draft dated August 28, 2026'

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cream">
      <LegalNav />
      <div className="max-w-3xl mx-auto px-8 py-16">

        <div className="border border-orange bg-orange/5 px-4 py-3 mb-8 font-mono text-[11px] text-orange leading-relaxed">
          <strong className="uppercase tracking-[0.08em]">Pre-launch draft:</strong>{' '}
          This policy is not final. Contact information, infrastructure locations, retention periods,
          and subprocessors must be confirmed before launch.
        </div>

        <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mb-4">
          Legal · Version {CURRENT_TERMS_VERSION} · Effective {EFFECTIVE_DATE}
        </p>
        <h1 className="font-serif text-[48px] leading-[1.0] font-medium tracking-[-0.02em] mb-2">
          Privacy Policy
        </h1>
        <p className="font-mono text-[12px] text-ink-soft mb-12 leading-relaxed">
          This Privacy Policy explains how Home Care Management Software ("we", "us") collects, uses, stores,
          and discloses personal information when you use the Homecare platform. We are committed to
          protecting personal information in accordance with applicable Canadian privacy legislation,
          including the Personal Information Protection and Electronic Documents Act (PIPEDA).
        </p>

        <hr className="border-ink mb-12" />

        <Section number="1" title="Who This Policy Applies To">
          <p>
            This policy applies to the home care agencies ("Agencies") that use the Platform, and to
            the personal information of their clients and workers that is processed through the Platform.
          </p>
          <p>
            It does not apply to the Agency's own privacy practices toward their service recipients —
            Agencies are independently responsible for their own privacy obligations.
          </p>
        </Section>

        <Section number="2" title="Information We Collect">
          <p><strong>Agency account data:</strong> Organisation name, administrator names, email addresses, billing information.</p>
          <p><strong>Worker data:</strong> Names, contact details, employment information, shift schedules, availability.</p>
          <p><strong>Client data:</strong> Names, dates of birth, addresses, care start dates, service types, and other care plan information entered by the Agency.</p>
          <p><strong>Usage data:</strong> Log data, IP addresses, browser type, pages visited, and timestamps — collected automatically when you use the Platform.</p>
          <Placeholder>
            Review this list with your lawyer and add any additional data points your system collects
            (e.g., GPS location if added later, voice notes, photos). PIPEDA requires you to be specific
            about what you collect and why.
          </Placeholder>
        </Section>

        <Section number="3" title="How We Use Personal Information">
          <p>We use the information collected to:</p>
          <ul>
            <li>Provide, operate, and improve the Platform</li>
            <li>Process scheduling, timesheets, and shift assignments</li>
            <li>Send transactional communications (invitations, shift reminders)</li>
            <li>Respond to support requests</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p>We do not sell personal information to third parties.</p>
        </Section>

        <Section number="4" title="Legal Basis for Processing">
          <p>
            Under PIPEDA, we collect, use, and disclose personal information only with the knowledge and
            consent of the individual, or where permitted by law. Agencies are responsible for obtaining
            appropriate consent from their workers and clients for the processing described in this policy.
          </p>
          <Placeholder>
            If you operate in Quebec, you must also comply with Law 25 (Bill 64), which has stricter
            requirements including privacy impact assessments. Your lawyer should address this specifically.
          </Placeholder>
        </Section>

        <Section number="5" title="Data Storage and Location">
          <p>
            The Platform uses third-party cloud infrastructure, including Supabase, to host application
            data and authentication services. Personal information may be processed or stored outside
            Newfoundland and Labrador or outside Canada, where it may be subject to the laws of the
            jurisdiction in which it is processed.
          </p>
          <Placeholder>
            Confirm the production hosting regions and all cross-border transfers before launch.
          </Placeholder>
        </Section>

        <Section number="6" title="Data Retention">
          <p>
            We retain account and operational data while an Agency&apos;s account is active and only as long
            afterward as reasonably necessary to provide an export, complete account closure, meet legal
            obligations, resolve disputes, and maintain security records. Agencies may request an export
            or deletion, subject to legal and contractual retention requirements.
          </p>
          <Placeholder>
            Set final export and deletion timeframes before launch; this draft does not promise a timeframe.
          </Placeholder>
        </Section>

        <Section number="7" title="Disclosure to Third Parties">
          <p>We may share personal information with:</p>
          <ul>
            <li><strong>Service providers</strong> who help us operate the Platform (hosting, authentication, email delivery), under data processing agreements</li>
            <li><strong>Legal authorities</strong> when required by law or court order</li>
          </ul>
          <p>
            Current service categories include Supabase for database and authentication, Stripe for
            subscription payments, the production web and API hosting providers, and Sentry when error
            monitoring is enabled. Payment-card details are processed by Stripe and are not stored directly
            by the Platform.
          </p>
          <Placeholder>
            Insert the final legal names and locations of every production subprocessor before launch.
          </Placeholder>
        </Section>

        <Section number="8" title="Security">
          <p>
            We implement industry-standard security measures including encrypted data transmission (TLS),
            authentication controls, and access restrictions to protect personal information against
            unauthorised access, disclosure, or misuse.
          </p>
          <p>
            Controls include authenticated access, role-based permissions, organization-level separation
            of agency records, restricted production credentials, and monitoring designed to avoid
            transmitting form contents. No method of storage or transmission is completely secure.
          </p>
          <Placeholder>
            Confirm encryption-at-rest, backup, restoration, security-testing, and incident-response practices before launch.
          </Placeholder>
        </Section>

        <Section number="9" title="Your Rights">
          <p>Under PIPEDA, individuals have the right to:</p>
          <ul>
            <li>Know what personal information we hold about them</li>
            <li>Access their personal information and request corrections</li>
            <li>Withdraw consent, subject to legal or contractual restrictions</li>
            <li>Lodge a complaint with the Office of the Privacy Commissioner of Canada</li>
          </ul>
          <p>
            A dedicated privacy contact method will be published here before the Platform accepts customers.
            Until then, this draft must not be presented as a final public policy.
          </p>
        </Section>

        <Section number="10" title="Cookies and Tracking">
          <Placeholder>
            Describe what cookies or local storage you use (authentication sessions, preferences),
            whether any analytics tools are in use, and how users can manage them.
          </Placeholder>
        </Section>

        <Section number="11" title="Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. The version number and effective date
            at the top of this page will reflect the current version. Material changes will be communicated
            to Agencies by email.
          </p>
        </Section>

        <Section number="12" title="Contact">
          <p>Home Care Management Software is based in St. John&apos;s, Newfoundland and Labrador, Canada.</p>
          <Placeholder>
            Appoint a privacy officer and add a monitored privacy email and service or mailing address before launch.
          </Placeholder>
        </Section>

        <hr className="border-ink mt-12 mb-8" />
        <p className="font-mono text-[10px] text-muted tracking-[0.08em] uppercase">
          Homecare · Privacy Policy · Version {CURRENT_TERMS_VERSION} · {EFFECTIVE_DATE}
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

function Placeholder({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  if (inline) {
    return <span className="text-orange font-semibold">[{children}]</span>
  }
  return (
    <div className="border border-dashed border-orange/60 bg-orange/5 px-4 py-3 text-orange text-[11px] leading-relaxed">
      <span className="font-semibold uppercase tracking-[0.08em] block mb-1">⚠ Lawyer review needed</span>
      {children}
    </div>
  )
}
