import { BoatLogo } from '@/shared/components/ui/BoatLogo'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CURRENT_TERMS_VERSION } from '@/shared/lib/legal'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
})

const EFFECTIVE_DATE = 'Draft dated October 9, 2026'

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
          This Privacy Policy explains how Care Harbor ("we", "us") collects, uses, stores,
          and discloses personal information when you use the Care Harbor agency website and worker mobile app. We are committed to
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

        <Section number="2" title="Information We Handle">
          <p><strong>Worker account access:</strong> Your Agency sends an invitation to your email address. You enter your name and set a password on the website before downloading and signing in to the worker mobile app. The mobile app is for existing worker accounts and does not offer sign-up or link to account setup. Password recovery remains available. Contact your Agency for help with account access.</p>
          <p><strong>Agency account data:</strong> Organisation and administrator details, account identifiers, subscription and billing records. Stripe processes payment-card details.</p>
          <p><strong>Worker data:</strong> Name, email, phone, address, date of birth and other profile details when supplied; emergency contacts; employment, availability, care preferences, languages and transport information; credential documents and expiry dates; assigned schedules and authored progress notes.</p>
          <p><strong>Client and care data:</strong> Identity and contact details, date of birth, address, emergency contacts, care needs and instructions, medical conditions, allergies, medications, scheduled visits and progress notes. Agencies may also enter internal administrative notes; these are not all exposed to workers.</p>
          <p><strong>Account and device data:</strong> Authentication identifiers and sessions; notification content and read state; and, when phone notifications are enabled, push tokens, installation identifiers, platform and delivery status needed to deliver work updates.</p>
          <p><strong>Operational records:</strong> Requests, errors and delivery events may be logged by our services and hosting providers. Optional website monitoring includes performance traces and error-triggered session replay, configured to mask text and block media. Optional server error monitoring is also configurable. Production logging fields, access and retention still need confirmation.</p>
          <p>The current worker app does not record GPS arrival/departure or voice notes. Selecting a credential file sends the chosen document for storage. Selecting directions passes the visit address to a maps app, whose own permissions and privacy practices apply.</p>
        </Section>

        <Section number="3" title="How Information Is Used and Accessed">
          <ul>
            <li>Authenticate users and check active agency and worker access.</li>
            <li>Manage schedules, client care information, credential records and visit progress notes.</li>
            <li>Send invitations, password recovery emails and work notifications, and maintain the in-app inbox.</li>
            <li>Administer agency subscriptions, support requests, security and legal obligations.</li>
          </ul>
          <p>Authorised agency staff manage agency records. Worker access is scoped to their agency, own profile and assigned care records, including retained visit history. A worker does not gain access to another agency merely by signing in.</p>
          <p>Displayed completed hours are estimates from scheduled visits; this release does not verify physical attendance or provide GPS-based worked hours.</p>
          <Placeholder>Confirm the final commercial data-use commitments, including whether information is ever used for advertising, sold or disclosed outside service delivery. The source review is not a substitute for confirming business practices.</Placeholder>
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

        <Section number="6" title="Retention, Account Closure and Deletion">
          <p>Account access, employment records and care records have different lifecycles. Removing a worker from an agency currently disables access and retains historical records; this is not a complete personal-data deletion process.</p>
          <p>A deletion request may require identity checks and coordination with the Agency responsible for the care records. Any records retained for legal, security or care-record obligations must have a stated reason and retention period. Signing out or uninstalling the app does not erase server records.</p>
          <p><Link to="/account-deletion" className="underline underline-offset-4">Request account deletion</Link> through our public account-help page. Current and former workers can request a review without signing in or reinstalling the app. Submission does not automatically terminate employment or erase agency care records.</p>
          <Placeholder>Before launch, configure and verify the monitored request mailbox and confirm the response, export and deletion timeframes for account data, care records, documents, logs, backups and service providers. No fixed deletion deadline is promised by this draft.</Placeholder>
        </Section>

        <Section number="7" title="Service Providers and Disclosures">
          <p>The implementation uses or integrates the following services. Confirm the production providers, legal entities, processing locations and agreements before treating this as a final subprocessor list.</p>
          <ul>
            <li><strong>Supabase:</strong> authentication, database and credential-file storage.</li>
            <li><strong>Vercel and Railway:</strong> website and API hosting in the current hosted setup.</li>
            <li><strong>Resend:</strong> transactional email delivery in the current authentication setup.</li>
            <li><strong>Expo and Google Firebase Cloud Messaging:</strong> Android push delivery when configured and enabled.</li>
            <li><strong>Stripe:</strong> agency subscription payments. Payment-card details are processed by Stripe.</li>
            <li><strong>Sentry, when enabled:</strong> website/server error monitoring, website performance traces and masked error-triggered session replay.</li>
          </ul>
          <p>Phone notification text is designed to omit patient details; the app checks access when the worker opens care information. Maps providers receive the destination when a worker requests directions. Information may also be disclosed where required by applicable law.</p>
          <Placeholder>Verify the live service inventory and all recipients against the signed release and Play Data safety answers, including provider telemetry and international processing.</Placeholder>
        </Section>

        <Section number="8" title="Security">
          <p>Implemented controls include authenticated API requests, role and agency access checks, worker access restrictions, short-lived signed links for credential downloads, and secure mobile session storage. Hosted connections use HTTPS.</p>
          <p>These controls reduce risk but do not guarantee that storage or transmission is completely secure. Production configuration and operating practices require separate verification.</p>
          <Placeholder>Confirm encryption at rest, production access management, backups and restoration, security testing, incident response and logging safeguards before launch.</Placeholder>
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

        <Section number="10" title="Local Storage and Phone Permissions">
          <p>The website stores authentication sessions and necessary preferences in browser storage. The mobile app stores authentication sessions in secure device storage and remembers introduction progress. Care information is loaded for authorised use; signing out clears the app session and cached query data. Selected credential files may be copied into the app&apos;s temporary file cache during upload; query-cache clearing does not establish that all temporary files have been erased.</p>
          <p>Phone notification permission is requested when enabling supported phone alerts. Users can manage alerts through their phone settings and can continue to use the in-app inbox with phone alerts disabled. File selection for credentials is initiated by the worker. The current app does not request location access for visit verification.</p>
          <Placeholder>Confirm the complete production cookie, analytics, crash-reporting and device-permission inventory against the signed Android build and all enabled hosting services.</Placeholder>
        </Section>

        <Section number="11" title="Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. The version number and effective date
            at the top of this page will reflect the current version. The final process for notifying Agencies and workers of material changes must be confirmed before launch.
          </p>
        </Section>

        <Section number="12" title="Contact">
          <p>Care Harbor is the product name. The operator&apos;s legal identity and public contact details must be confirmed before publication.</p>
          <Placeholder>
            Appoint a privacy officer and add a monitored privacy email and service or mailing address before launch.
          </Placeholder>
        </Section>

        <hr className="border-ink mt-12 mb-8" />
        <p className="font-mono text-[10px] text-muted tracking-[0.08em] uppercase">
          Care Harbor · Privacy Policy · Version {CURRENT_TERMS_VERSION} · {EFFECTIVE_DATE}
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

function Placeholder({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  if (inline) {
    return <span className="text-orange font-semibold">[{children}]</span>
  }
  return (
    <div className="border border-dashed border-orange/60 bg-orange/5 px-4 py-3 text-orange text-[11px] leading-relaxed">
      <span className="font-semibold uppercase tracking-[0.08em] block mb-1">Confirmation and legal review needed</span>
      {children}
    </div>
  )
}
