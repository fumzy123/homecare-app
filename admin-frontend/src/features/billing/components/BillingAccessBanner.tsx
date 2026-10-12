import { ArrowRight, LockKeyhole } from 'lucide-react'
import { Link } from '@tanstack/react-router'

/** Layer 2: presents the access restriction supplied by the app shell. */
export function BillingAccessBanner({ owner }: { owner: boolean }) {
  return <div role="status" className="shrink-0 border-b border-[#D9B98B] bg-[#FBF0DE] px-4 py-4 sm:px-6">
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F1DFC2] text-[#754B19]"><LockKeyhole size={18} aria-hidden="true" /></span>
        <div>
          <p className="text-sm font-semibold text-[#553A19]">Your workspace is in read-only mode</p>
          <p className="mt-1 text-sm leading-5 text-[#684F30]">You can still view and export records. {owner ? 'Review billing to restore editing.' : 'Ask your agency owner to resolve billing and restore editing.'}</p>
        </div>
      </div>
      <Link to="/settings/billing" className="inline-flex min-h-11 items-center justify-center gap-3 rounded-lg border border-[#754B19]/25 bg-paper px-4 py-2 text-sm font-semibold text-[#553A19] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#754B19] max-sm:w-full">
        {owner ? 'Review billing' : 'View billing status'}<ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  </div>
}
