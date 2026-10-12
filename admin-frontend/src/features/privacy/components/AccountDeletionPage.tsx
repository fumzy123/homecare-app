import { Link } from '@tanstack/react-router'
import { BoatLogo } from '@/shared/components/ui/BoatLogo'
import { deletionContact } from '../lib/deletionContact'

/** Layer 3: public account-help content; no session or agency access required. */
export function AccountDeletionPage() {
  const contact = deletionContact(import.meta.env.VITE_PRIVACY_CONTACT_EMAIL)
  return (
    <div className="min-h-screen bg-cream text-ink">
      <nav aria-label="Account help" className="flex flex-wrap items-center justify-between gap-4 border-b border-ink bg-paper px-6 py-5">
        <Link to="/login" className="flex items-center gap-3 font-serif text-xl"><BoatLogo size={24} />Care Harbor</Link>
        <Link to="/privacy" className="text-sm underline underline-offset-4">Privacy Policy</Link>
      </nav>
      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-20">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-ink-soft">Worker account help</p>
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Request account deletion</h1>
        <p className="mt-6 text-base leading-7 text-ink-soft">
          You can ask Care Harbor to delete your worker app account and associated personal data.
          You do not need to sign in or reinstall the app. Current and former workers can both make a request.
        </p>

        <section aria-labelledby="send-request" className="my-8 rounded-2xl border border-ink/15 bg-paper p-6">
          <h2 id="send-request" className="font-serif text-2xl">Send your request</h2>
          {contact ? <>
            <p className="mt-3 leading-7">Email <a className="break-all underline underline-offset-4" href={contact.href}>{contact.email}</a> with the subject <strong>Care Harbor account deletion request</strong>.</p>
            <a href={contact.href} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-ink px-5 py-3 text-sm font-medium text-paper">Write an email request</a>
            <p className="mt-3 text-sm leading-6 text-ink-soft">This opens your email app. Send the email to submit your request. You can also copy the address into your preferred email service.</p>
          </> : <p role="status" className="mt-3 leading-7">The Care Harbor request mailbox has not been published yet. This request channel is not available. Please contact your agency for privacy assistance.</p>}
          <p className="mt-4 leading-7">Include the email used for Care Harbor and your agency&apos;s name. If you cannot use your account email, tell us how we can contact you to verify the request.</p>
          <p className="mt-3 text-sm leading-6 text-ink-soft">Do not send passwords, patient information, identity documents or credential files in your initial email.</p>
        </section>

        <section aria-labelledby="next-steps" className="mb-8">
          <h2 id="next-steps" className="font-serif text-2xl">What happens next</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-6 leading-7">
            <li>We acknowledge your request, verify your identity and provide an expected completion date.</li>
            <li>We coordinate with your agency to review the account, any current work arrangements and record-retention obligations.</li>
            <li>We remove the account and data that no longer needs to be kept, and explain any information retained, its reason and its retention period or review criteria.</li>
          </ol>
          <p className="mt-4 leading-7">Submitting a request does not immediately disable your access, end employment, cancel visits or erase care records. We will explain the effect on your access before processing it. You do not need to resign to submit a request.</p>
        </section>

        <section aria-labelledby="records" className="mb-8">
          <h2 id="records" className="font-serif text-2xl">Account data and agency records</h2>
          <p className="mt-4 leading-7">Account deletion includes your login and a review of personal data such as phone notification registrations, availability, care preferences, emergency contacts and other profile details that are no longer needed.</p>
          <p className="mt-3 leading-7">Your agency may need to retain employment records, credential evidence, historical visits, progress notes and their authorship for legal, care-record or security reasons. Retention is assessed for the relevant records; it does not give the agency an unlimited right to keep all account data.</p>
          <p className="mt-3 leading-7">Provider records and backups may have separate retention periods. We will explain applicable exceptions and any remaining steps when responding to your request. Signing out or uninstalling the app does not delete server records.</p>
        </section>
        <Link to="/privacy" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Read the Privacy Policy</Link>
      </main>
    </div>
  )
}
