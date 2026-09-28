export function LaunchFeatures() {
  return <section aria-labelledby="launch-features-title" className="border-b border-ink bg-paper px-10 max-md:px-6 py-16">
    <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
      <div>
        <h2 id="launch-features-title" className="font-serif text-3xl mb-5">Included at launch</h2>
        <ul className="space-y-3 text-sm text-ink-soft list-disc pl-5">
          <li>Recurring scheduling, calendar and day views, conflict checks, and overtime review.</li>
          <li>Client records, weekly care plans, authorizations, visit history, and office-entered progress notes.</li>
          <li>Worker credentials, leave, and attendance records managed by office staff.</li>
          <li>Post and manage placement openings from the office.</li>
          <li>Dashboard panels for upcoming credential and authorization expirations.</li>
          <li>Administrator in-app notifications and scheduled-hours timesheet CSV export.</li>
          <li>Unlimited workers and staff seats.</li>
        </ul>
        <p className="text-sm text-ink-soft mt-5 leading-relaxed">A completed status can be applied automatically after a scheduled visit ends. It does not prove attendance or hours worked. Review timesheets before payroll.</p>
      </div>
      <div>
        <h2 className="font-serif text-3xl mb-5">On the roadmap</h2>
        <p className="text-sm text-ink-soft mb-4">These features are not included today. No release dates are promised.</p>
        <ul className="space-y-3 text-sm text-ink-soft list-disc pl-5">
          <li>Worker mobile app, shift confirmations, and the complete worker-interest placement workflow.</li>
          <li>Push notifications.</li>
          <li>Electronic visit verification and GPS check-in/out.</li>
          <li>Client invoicing and a family portal.</li>
        </ul>
        <p className="text-sm text-ink-soft mt-5 leading-relaxed">Keep your existing client invoicing process. Expiry panels are checked in the dashboard; automated expiry reminders by email or push are not included.</p>
      </div>
    </div>
  </section>
}
