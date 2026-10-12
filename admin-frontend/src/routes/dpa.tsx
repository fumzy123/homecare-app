import { BoatLogo } from '@/shared/components/ui/BoatLogo'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CURRENT_TERMS_VERSION } from '@/shared/lib/legal'

export const Route = createFileRoute('/dpa')({
  component: DpaPage,
})

const EFFECTIVE_DATE = 'Draft dated October 3, 2026'

function DpaPage() {
  return (
    <div className="min-h-screen bg-cream">
      <LegalNav />
      <div className="max-w-3xl mx-auto px-8 py-16">

        <div className="border border-orange bg-orange/5 px-4 py-3 mb-8 font-mono text-[11px] text-orange leading-relaxed">
          <strong className="uppercase tracking-[0.08em]">Pre-launch draft:</strong>{' '}
          This DPA is not final and must not be accepted on behalf of customers until its operational
          details, legal operator identity and subprocessors have been confirmed and reviewed.
        </div>

        <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mb-4">
          Legal · Version {CURRENT_TERMS_VERSION} · Effective {EFFECTIVE_DATE}
        </p>
        <h1 className="font-serif text-[48px] leading-[1.0] font-medium tracking-[-0.02em] mb-2">
          Data Processing Agreement
        </h1>
        <p className="font-mono text-[12px] text-ink-soft mb-12 leading-relaxed">
          This Data Processing Agreement ("DPA") forms part of the Terms of Service between Care Harbor
          ("Processor") and the home care Agency ("Controller") that has accepted those Terms. It governs
          the processing of personal data on the Agency's behalf through the Care Harbor platform, in accordance
          with applicable Canadian privacy legislation including PIPEDA.
        </p>

        <hr className="border-ink mb-12" />

        <Section number="1" title="Roles and Responsibilities">
          <p>
            The Agency acts as the <strong>Controller</strong> — it determines the purposes for which personal data
            is collected and processed (scheduling and care administration).
          </p>
          <p>
            Care Harbor acts as the <strong>Processor</strong> — it processes personal data only on
            the Controller's documented instructions and solely to provide the Platform services.
          </p>
        </Section>

        <Section number="2" title="Categories of Personal Data Processed">
          <ul>
            <li><strong>Client and care records:</strong> identity, contact details, date of birth, addresses, emergency contacts, medical conditions, allergies, medications, care instructions, weekly needs, funding records, visits and progress notes.</li>
            <li><strong>Worker records:</strong> identity and contact details, supplied profile information, emergency contacts, employment, availability, preferences, credentials and uploaded documents, schedules and authored notes.</li>
            <li><strong>Service records:</strong> account identifiers and sessions, notification and read state, registered push devices and delivery records, and configured operational logs.</li>
            <li><strong>Visit timing:</strong> scheduled times and derived completion status/hours; these are not GPS-verified attendance or payroll records.</li>
          </ul>
          <p>Data subjects include clients, workers, agency administrators and emergency contacts entered by an Agency or worker.</p>
        </Section>

        <Section number="3" title="Purpose and Duration of Processing">
          <p>
            The Processor processes personal data solely to provide the Platform services as described
            in the Terms of Service. Processing continues for the duration of the Agency's subscription
            and for any retention period specified in the Privacy Policy.
          </p>
        </Section>

        <Section number="4" title="Processor Obligations">
          <p>The Processor agrees to:</p>
          <ul>
            <li>Process personal data only on documented instructions from the Controller</li>
            <li>Ensure that persons authorised to process personal data are bound by confidentiality</li>
            <li>Implement appropriate technical and organisational security measures</li>
            <li>Assist the Controller in responding to individual rights requests</li>
            <li>Return or delete personal data under the agreed termination and retention arrangements, subject to applicable legal obligations</li>
            <li>Provide information necessary to demonstrate compliance with this DPA</li>
          </ul>
        </Section>

        <Section number="5" title="Sub-processors">
          <p>The current implementation integrates Supabase (authentication, database and document storage), Vercel (website hosting), Railway (API hosting), Resend (transactional email), Expo and Google Firebase Cloud Messaging (phone notifications), Stripe (agency payments) and Sentry when enabled (error monitoring, website performance traces and masked error-triggered session replay).</p>
          <Placeholder>Approve a production subprocessor schedule with each legal entity, purpose, data categories, location, contractual role and safeguards. Confirm the change-notification process and any required authorisation. This implementation inventory does not establish that every listed provider acts as a processor for every activity.</Placeholder>
        </Section>

        <Section number="6" title="Security Measures">
          <p>Application controls include authentication, role/agency/worker access checks, short-lived signed document download links, secure mobile session storage and HTTPS connections in the hosted setup.</p>
          <Placeholder>Complete the operational security schedule: encryption at rest, administrator access, backups and restore tests, vulnerability management, incident response, confidentiality and training. These practices have not all been verified by a source-code review.</Placeholder>
        </Section>

        <Section number="7" title="Data Breach Notification">
          <p>The final agreement must define notification to the Agency, cooperation, available incident details and responsibilities for legally required reporting to individuals and authorities, in accordance with applicable law.</p>
          <Placeholder>Confirm an achievable notification deadline and incident-response procedure. The previous draft&apos;s fixed 72-hour commitment has not been operationally verified; this draft does not establish that deadline. Obtain review of applicable federal and provincial breach-reporting requirements.</Placeholder>
        </Section>

        <Section number="8" title="Controller Obligations">
          <p>The Controller agrees to:</p>
          <ul>
            <li>Ensure it has a lawful basis to provide personal data to the Processor</li>
            <li>Ensure individuals whose data is processed have been appropriately informed</li>
            <li>Not instruct the Processor to process data in a manner that violates applicable law</li>
          </ul>
        </Section>

        <Section number="9" title="Cross-border Data Transfers">
          <p>
            Some subprocessors may process personal data outside Canada. The Processor will remain
            accountable for personal data transferred to its subprocessors and will use contractual and
            technical safeguards appropriate to the sensitivity of the information.
          </p>
          <Placeholder>
            Confirm production data regions and identify the countries involved before launch.
          </Placeholder>
        </Section>

        <Section number="10" title="Term, Return and Deletion">
          <p>The agreement covers the agency service and the agreed period for return, deletion and any legally required retention. Deactivating an account alone does not delete stored care, employment or document records.</p>
          <Placeholder>Agree and implement export and deletion procedures, identity/authority checks, retained-record reasons and periods, backup handling and subprocessor requests before execution. The previous draft&apos;s 30-day deletion and written-confirmation promise is not yet supported by a verified process.</Placeholder>
        </Section>

        <Section number="11" title="Governing Law">
          <p>
            This DPA is governed by the laws of the Province of Newfoundland and Labrador and the federal
            laws of Canada applicable there. Proceedings relating to this DPA will be brought in the courts
            located in St. John&apos;s, Newfoundland and Labrador, subject to mandatory applicable law.
          </p>
          <Placeholder>Confirm this jurisdiction and dispute-resolution language before launch.</Placeholder>
        </Section>

        <Section number="12" title="Execution">
          <p>
            This DPA is incorporated by reference into the Terms of Service. The Agency's acceptance of
            the Terms of Service by an authorised representative constitutes acceptance of this DPA on behalf of the Controller. A worker signing into the mobile app does not by that action accept this agreement on the Agency&apos;s behalf.
          </p>
        </Section>

        <hr className="border-ink mt-12 mb-8" />
        <p className="font-mono text-[10px] text-muted tracking-[0.08em] uppercase">
          Care Harbor · Data Processing Agreement · Version {CURRENT_TERMS_VERSION} · {EFFECTIVE_DATE}
        </p>
      </div>
    </div>
  )
}

function LegalNav() {
  return (
    <div className="border-b border-ink px-8 py-4 flex flex-wrap gap-4 items-center justify-between bg-paper">
      <Link to="/login" className="flex items-center gap-3 group">
        <BoatLogo size={22} />
        <span className="font-serif text-[16px] leading-none tracking-[-0.02em] font-medium">Care Harbor</span>
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
      <span className="font-semibold uppercase tracking-[0.08em] block mb-1">Confirmation and legal review needed</span>
      {children}
    </div>
  )
}
