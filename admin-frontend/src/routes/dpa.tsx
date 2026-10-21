import { BoatLogo } from '@/shared/components/ui/BoatLogo'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CURRENT_TERMS_VERSION } from '@/shared/lib/legal'

export const Route = createFileRoute('/dpa')({
  component: DpaPage,
})

const EFFECTIVE_DATE = 'Draft dated October 16, 2026'

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
          This draft Data Processing Agreement ("DPA") describes the proposed information-handling
          agreement between the legal operator of Care Harbor ("Provider") and the home care Agency
          identified in the final customer agreement. For personal health information subject to
          Newfoundland and Labrador&apos;s Personal Health Information Act ("PHIA"), it is intended
          to serve as an Information Management Agreement under section 22. Other applicable privacy
          laws, including PIPEDA where applicable, continue to apply.
        </p>

        <hr className="border-ink mb-12" />

        <Section number="1" title="Roles and Responsibilities">
          <p>
            Where the Agency is a PHIA custodian, the Provider acts as its information manager for
            the services covered by this agreement. The terms personal health information, custodian
            and information manager have their meanings under PHIA. The Agency retains custody and
            control of that information and its own statutory responsibilities.
          </p>
          <p>
            The Provider must comply with PHIA, its regulations and this agreement in handling that
            information. It may use or disclose the information only as this agreement authorises,
            subject to applicable legal requirements. The Agency&apos;s instructions cannot authorise
            unlawful handling. These roles do not determine the legal treatment of every worker,
            account or billing record.
          </p>
          <Placeholder>Identify both legal entities, addresses, authorised representatives and privacy contacts. Confirm the Agency&apos;s custodian status, the Provider&apos;s role and any health-authority contract requirements. Separately describe the Provider&apos;s own account and billing activities in the Privacy Policy.</Placeholder>
        </Section>

        <Section number="2" title="Categories of Personal Data Processed">
          <ul>
            <li><strong>Client and care records:</strong> identity, contact details, date of birth, addresses, emergency contacts, medical conditions, allergies, medications, care instructions, weekly needs, visits and progress notes.</li>
            <li><strong>Worker records:</strong> identity and contact details, supplied profile information, emergency contacts, employment, availability, preferences, credentials and uploaded documents, schedules and authored notes.</li>
            <li><strong>Service records:</strong> account identifiers and sessions, notification and read state, registered push devices and delivery records, and configured operational logs.</li>
            <li><strong>Visit timing:</strong> scheduled times and derived completion status/hours; these are not GPS-verified attendance or payroll records.</li>
          </ul>
          <p>Data subjects include clients, workers, agency administrators and emergency contacts entered by an Agency or worker.</p>
        </Section>

        <Section number="3" title="Purpose and Duration of Processing">
          <p>
            Authorised services comprise the agreed scheduling, care-record, worker-record and
            notification functions. Imports, support and troubleshooting involving Agency records
            require documented Agency authorisation and access limited to the task. Agency records
            must not be used for the Provider&apos;s advertising, sold, or used to train general-purpose
            AI models. New purposes require a lawful basis and an agreed written change before use.
          </p>
          <p>Processing starts on the agreed service date and continues only for the service and the return, retention and deletion arrangements in the completed schedules. Ending a subscription does not itself authorise destruction of care records.</p>
          <Placeholder>Complete Schedule A with the service start and end arrangements, enabled features, necessary data fields, authorised users and support/import access conditions. Confirm the proposed data-use commitments before execution.</Placeholder>
        </Section>

        <Section number="4" title="Provider Obligations">
          <p>The Provider agrees to:</p>
          <ul>
            <li>Follow lawful documented Agency instructions within the purposes authorised by this agreement</li>
            <li>Before allowing access to PHIA information, obtain written commitments from employees and persons acting on its behalf to comply with PHIA and this agreement&apos;s restrictions, as required by section 22(5)</li>
            <li>Limit access to authorised duties, maintain confidentiality, and provide appropriate privacy training</li>
            <li>Protect records against unauthorised access, use, disclosure, alteration, loss and disposal through the agreed safeguards</li>
            <li>Assist the Agency with access, correction and complaint requests through the procedure in section 13</li>
            <li>Return or delete personal data under the agreed termination and retention arrangements, subject to applicable legal obligations</li>
            <li>Keep appropriate evidence of its compliance and cooperate with the agreed compliance checks</li>
          </ul>
        </Section>

        <Section number="5" title="Sub-processors">
          <p>The current implementation integrates Supabase (authentication, database and document storage), Vercel (website hosting), Railway (API hosting), Resend (transactional email), Expo and Google Firebase Cloud Messaging (phone notifications), Stripe (agency payments) and Sentry when enabled (error monitoring, website performance traces and masked error-triggered session replay).</p>
          <p>The Provider will use providers handling Agency records only within the agreed scope and under written protections appropriate to their role. Delegation does not remove the Provider&apos;s obligations. The approved list must distinguish services enabled for the admin launch from deferred mobile services.</p>
          <Placeholder>Complete Schedule B with each enabled provider&apos;s legal entity, purpose, data categories, processing/support locations, contractual role and applicable agreements. Verify written commitments throughout the access chain. Agree advance change notice, any required approval or objection process and the remedy if a proposed provider is unacceptable. This inventory alone is not an approved subprocessor list.</Placeholder>
        </Section>

        <Section number="6" title="Security Measures">
          <p>Application controls include authentication, role/agency/worker access checks, short-lived signed document download links, secure mobile session storage and HTTPS connections in the hosted setup.</p>
          <p>The Provider will maintain the safeguards agreed in Schedule C for transfer, storage, access, changes and disposal. The Agency and Provider will each maintain the agreed security of the devices, accounts and systems they control.</p>
          <Placeholder>Complete and verify Schedule C: encryption in transit and at rest, administrator authentication, support access, access/change logs, device requirements, patching, backups, restoration, recovery targets, incident handling, confidentiality and training. Describe each party&apos;s hardware/software responsibilities. A description of application code does not establish that production safeguards have been verified.</Placeholder>
        </Section>

        <Section number="7" title="Data Breach Notification">
          <p>The Provider will notify the designated Agency incident contact without undue delay after becoming aware of a suspected or confirmed privacy breach affecting Agency information. It will take appropriate containment steps, preserve relevant evidence, investigate and provide updates as facts become available. Initial notice must not wait for a complete investigation.</p>
          <p>Notices will include known timing, affected systems and information, likely consequences, containment measures and a response contact. The parties will coordinate individual and regulator notifications under applicable law. The Agency retains its custodian duties; neither party may use this agreement to delay its own statutory obligations.</p>
          <Placeholder>Record monitored contacts, an absence/escalation arrangement, the contractual notification deadline and update frequency in Schedule C. Have the incident procedure checked against PHIA sections 15 and 20, the regulations&apos; material-breach factors, and PIPEDA where applicable. No universal 72-hour reporting rule is assumed.</Placeholder>
        </Section>

        <Section number="8" title="Agency Obligations">
          <p>The Agency agrees to:</p>
          <ul>
            <li>Establish its authority to provide the information to the Provider, including consent where required</li>
            <li>Ensure individuals whose data is processed have been appropriately informed</li>
            <li>Provide lawful instructions, designate privacy and incident contacts, and approve access only for authorised duties</li>
            <li>Maintain its own required notices, confidentiality commitments, training and record-retention decisions</li>
            <li>Notify the Provider of relevant access changes, restrictions, requests and preservation requirements</li>
          </ul>
        </Section>

        <Section number="9" title="Cross-border Data Transfers">
          <p>
            Some subprocessors may process personal data outside Canada. The Provider will remain
            accountable for personal data transferred to its subprocessors and will use contractual and
            technical safeguards appropriate to the sensitivity of the information.
          </p>
          <Placeholder>
            Confirm storage, backup, support and other processing locations in Schedule B and assess the legal authority and safeguards for transfers, including PHIA section 47 where applicable. Check the Agency&apos;s contractual location restrictions. A Canadian database region alone does not establish that all processing remains in Canada.
          </Placeholder>
        </Section>

        <Section number="10" title="Term, Return and Deletion">
          <p>The agreement covers the agency service and the agreed period for return, deletion and any legally required retention. Deactivating an account alone does not delete stored care, employment or document records.</p>
          <p>On termination, the Provider will return or securely transfer Agency records using the agreed format and process, then remove copies according to Schedule D, subject to lawful retention or preservation requirements. Retained copies must remain protected, restricted to the retention purpose and scheduled for review or deletion. A completion record must distinguish completed removal from outstanding provider or backup expiry.</p>
          <Placeholder>Complete and test Schedule D: category-specific retention grounds and periods, access during exit, export contents/format, transfer method, deadlines, fees, identity/authority checks, legal holds, secure destruction, provider cleanup and backup expiry. Define how completed deletions are reapplied after restoration. The worker-account helper is not a complete agency export/deletion service; no fixed 30-day deletion promise is made.</Placeholder>
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
            Once finalised, this DPA and its completed schedules will form part of the customer agreement.
            Acceptance must identify the parties, authorised representatives, accepted documents and
            versions, and acceptance date. A worker signing into the mobile app does not accept this
            agreement on the Agency&apos;s behalf.
          </p>
          <Placeholder>Agree signatures or a reviewed electronic acceptance process and document precedence with the Terms. Complete Schedules A–D and retain an immutable copy of the accepted package. Draft-version acceptance is not acceptance of a future final agreement; publish and obtain acceptance of the reviewed final version before customer use.</Placeholder>
        </Section>

        <Section number="13" title="Requests, Accuracy and Compliance Checks">
          <p>The Provider will route requests concerning Agency care records to the designated Agency contact and assist with locating, securely exporting and correcting records. It will verify identity and authority before disclosure or changes, preserve required history, and record authorised corrections without silently replacing original care entries. Requests concerning the Provider&apos;s own activities will be handled under its Privacy Policy.</p>
          <p>The Provider will supply relevant compliance information and cooperate with proportionate reviews, including agreed audits. Reviews must protect other customers&apos; information and security credentials and do not restrict lawful regulator powers.</p>
          <Placeholder>In Schedules C and D, agree request escalation and response times that support statutory deadlines, correction and integrity checks, complaint handling, audit scope/frequency, notice, costs, evidence access and remediation. Verify the necessary export and history-preservation capabilities before promising them.</Placeholder>
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
