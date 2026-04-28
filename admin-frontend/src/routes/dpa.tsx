import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/dpa')({
  component: DpaPage,
})

const EFFECTIVE_DATE = 'May 1, 2026'
const VERSION = '0.0'

function DpaPage() {
  return (
    <div className="min-h-screen bg-cream">
      <LegalNav />
      <div className="max-w-3xl mx-auto px-8 py-16">

        <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mb-4">
          Legal · Version {VERSION} · Effective {EFFECTIVE_DATE}
        </p>
        <h1 className="font-serif text-[48px] leading-[1.0] font-medium tracking-[-0.02em] mb-2">
          Data Processing Agreement
        </h1>
        <p className="font-mono text-[12px] text-ink-soft mb-12 leading-relaxed">
          This Data Processing Agreement ("DPA") forms part of the Terms of Service between [YOUR COMPANY LEGAL NAME]
          ("Processor") and the home care Agency ("Controller") that has accepted those Terms. It governs
          the processing of personal data on the Agency's behalf through the Homecare platform, in accordance
          with applicable Canadian privacy legislation including PIPEDA.
        </p>

        <hr className="border-ink mb-12" />

        <Section number="1" title="Roles and Responsibilities">
          <p>
            The Agency acts as the <strong>Controller</strong> — it determines the purposes for which personal data
            is collected and processed (scheduling, care management, payroll).
          </p>
          <p>
            [YOUR COMPANY LEGAL NAME] acts as the <strong>Processor</strong> — it processes personal data only on
            the Controller's documented instructions and solely to provide the Platform services.
          </p>
        </Section>

        <Section number="2" title="Categories of Personal Data Processed">
          <p>The Processor processes the following categories of data on the Controller's behalf:</p>
          <ul>
            <li><strong>Client data:</strong> Names, dates of birth, addresses, service types, care start dates</li>
            <li><strong>Worker data:</strong> Names, contact details, employment information, shift records</li>
            <li><strong>Timesheet data:</strong> Shift times, completion status, hours worked</li>
          </ul>
          <Placeholder>
            Expand this list to match every data field your system stores. Be exhaustive — PIPEDA's
            accountability principle requires you to be able to account for all personal data in your custody.
          </Placeholder>
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
            <li>Delete or return all personal data upon termination of the agreement</li>
            <li>Provide information necessary to demonstrate compliance with this DPA</li>
          </ul>
        </Section>

        <Section number="5" title="Sub-processors">
          <p>The Processor uses the following sub-processors to deliver the Platform:</p>
          <Placeholder>
            List every third-party service that touches personal data. At minimum this includes your
            hosting provider, your authentication provider (Supabase), and your email delivery provider.
            For each, specify: name, location, and purpose. You must notify the Controller of any
            changes to sub-processors.
          </Placeholder>
        </Section>

        <Section number="6" title="Security Measures">
          <Placeholder>
            List the specific technical and organisational measures you have implemented:
            encryption in transit (TLS), encryption at rest, access controls, authentication requirements,
            vulnerability management, incident response procedures, and employee training.
          </Placeholder>
        </Section>

        <Section number="7" title="Data Breach Notification">
          <p>
            In the event of a personal data breach, the Processor will notify the Controller without
            undue delay after becoming aware of the breach, and in any case within 72 hours.
            The notification will include the nature of the breach, categories of data affected,
            and remediation steps taken.
          </p>
          <Placeholder>
            Under PIPEDA, breaches that pose a real risk of significant harm must be reported to the
            Office of the Privacy Commissioner of Canada and to affected individuals. Your lawyer should
            align this clause with those requirements.
          </Placeholder>
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
          <Placeholder>
            Specify whether personal data is transferred outside Canada, to which countries, and what
            safeguards are in place. PIPEDA requires comparable protection when data leaves Canada.
            If using Supabase (US-based), this is relevant.
          </Placeholder>
        </Section>

        <Section number="10" title="Term and Termination">
          <p>
            This DPA is effective for the duration of the Terms of Service. Upon termination, the Processor
            will, at the Controller's election, delete or return all personal data within 30 days, and
            provide written confirmation of deletion.
          </p>
        </Section>

        <Section number="11" title="Governing Law">
          <Placeholder>
            Specify governing jurisdiction (recommend matching the Terms of Service) and the process
            for resolving disputes under this DPA.
          </Placeholder>
        </Section>

        <Section number="12" title="Execution">
          <p>
            This DPA is incorporated by reference into the Terms of Service. The Agency's acceptance of
            the Terms of Service constitutes acceptance of this DPA on behalf of the Controller.
          </p>
        </Section>

        <hr className="border-ink mt-12 mb-8" />
        <p className="font-mono text-[10px] text-muted tracking-[0.08em] uppercase">
          Homecare · Data Processing Agreement · Version {VERSION} · {EFFECTIVE_DATE}
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
