import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowLeft, ArrowRight, Building2, LockKeyhole, LogOut, Search, SlidersHorizontal } from 'lucide-react'
import { BoatLogo } from '@/shared/components/ui/BoatLogo'
import { useAuthStore } from '@/shared/stores/auth'
import { useOperatorAccess, useOperatorAgencies, useOperatorSignOut } from '../hooks/useBillingOperator'
import { ApiError } from '@/shared/lib/api-client'
import type { OperatorAccess } from '../operator-api'
import { OperatorAgencyPanel } from './OperatorAgencyPanel'
import { OperatorWebhookAlerts } from './OperatorWebhookAlerts'
import { OperatorBillingReviews } from './OperatorBillingReviews'
import { OperatorBadge, OperatorRefresh } from './OperatorStatus'
import { operatorButton, operatorInput, operatorPrimaryButton } from './operator-styles'

export function OperatorBillingLink() {
  const userId = useAuthStore(s => s.user?.id)
  const access = useOperatorAccess(userId)
  return access.data?.is_operator ? <Link to="/billing-operations" className="underline">Open internal billing controls</Link> : null
}

// Layer 3: coordinates access and workspace data through named feature hooks.
export function BillingOperatorPage() {
  const userId = useAuthStore(s => s.user?.id)
  const access = useOperatorAccess(userId)
  const signOut = useOperatorSignOut()
  return <div className="min-h-screen bg-cream text-ink">
    <a href="#billing-workspace" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:rounded-lg focus:bg-ink focus:p-4 focus:text-paper">Skip to billing workspace</a>
    <header className="border-b border-ink/15 bg-paper">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3"><BoatLogo size={36} /><span className="font-serif text-2xl tracking-tight">Care Harbor</span><span className="ml-4 hidden border-l border-ink/20 pl-6 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft sm:inline">Operator workspace</span></div>
        <button className={operatorButton} disabled={signOut.isPending} onClick={() => signOut.mutate()}><LogOut size={15} aria-hidden="true" />{signOut.isPending ? 'Signing out…' : 'Sign out'}</button>
      </div>
    </header>
    <main id="billing-workspace" className="mx-auto max-w-[1440px] px-5 pb-12 pt-8 sm:px-8 lg:px-12 lg:pt-12">
      {signOut.isError && <p role="alert" className="mb-5 rounded-lg bg-orange-soft p-4">Could not sign out. Please try again.</p>}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div><p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">Care Harbor / Billing</p>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Billing operations<span className="text-orange">.</span></h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">A clear view of agency billing. Find an account, review questions, and follow up on payment activity.</p>
        </div>
        <span className="flex items-center gap-2 text-xs text-ink-soft"><LockKeyhole size={14} aria-hidden="true" /> Internal operator access</span>
      </div>
      {access.isPending ? <p role="status" className="rounded-xl border border-ink/15 bg-paper p-6">Checking operator access…</p>
        : access.isError || !access.data.is_operator ? <div role="alert" className="space-y-4 rounded-xl border border-ink/15 bg-paper p-6">
          <p>{!access.isError || (access.error instanceof ApiError && access.error.code === 'FORBIDDEN') ? 'This account is not an authorized billing operator. Agency owner access does not grant operator permissions.' : 'Could not verify operator access.'}</p>
          <button className={operatorButton} disabled={access.isFetching} onClick={() => void access.refetch()}>Retry access check</button>
        </div> : <OperatorWorkspace access={access.data} />}
    </main>
  </div>
}

// Layer 2: configuration is read-only and reflects the existing server permissions.
function OperatorConfiguration({ access }: { access: OperatorAccess }) {
  const settings = [
    { label: 'Onboarding', enabled: access.onboarding_enabled },
    { label: 'Usage settlement', enabled: access.settlement_enabled && access.onboarding_enabled },
    { label: 'Live settlement permission', enabled: access.live_settlement_enabled },
  ]
  return <section aria-label="Billing configuration" className="mb-7 overflow-hidden rounded-xl border border-ink/15 bg-paper">
    <div className="grid divide-y divide-ink/10 lg:grid-cols-[auto_1fr_1fr_1.2fr] lg:divide-x lg:divide-y-0">
      <div className="flex items-center gap-2.5 px-5 py-4 text-sm font-medium"><SlidersHorizontal size={16} aria-hidden="true" />Billing configuration</div>
      {settings.map(setting => <div key={setting.label} className="flex items-center justify-between gap-3 px-5 py-4"><span className="text-xs text-ink-soft">{setting.label}</span><OperatorBadge tone={setting.enabled ? 'success' : 'neutral'}>{setting.enabled ? 'Enabled' : 'Disabled'}</OperatorBadge></div>)}
    </div>
  </section>
}

function OperatorWorkspace({ access }: { access: OperatorAccess }) {
  const userId = useAuthStore(s => s.user?.id)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const agencies = useOperatorAgencies(userId, search)
  const agencyRows = agencies.data?.pages.flatMap(page => page.agencies) ?? []
  const detailRef = useRef<HTMLDivElement>(null)
  const directoryRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (selected) detailRef.current?.focus() }, [selected])
  const selectAgency = (org: string) => {
    if (selected === org) detailRef.current?.focus()
    else setSelected(org)
  }
  const closeAgency = () => { setSelected(null); directoryRef.current?.focus() }
  return <>
    <OperatorConfiguration access={access} />
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <section aria-labelledby="agency-directory" className="min-w-0 overflow-hidden rounded-2xl border border-ink/15 bg-paper">
        <div className="flex items-start justify-between gap-3 px-5 pb-5 pt-6 sm:px-7">
          <div><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">Agency accounts</p><h2 id="agency-directory" ref={directoryRef} tabIndex={-1} className="font-serif text-3xl">Find an agency</h2><p className="mt-2 text-sm text-ink-soft">Review subscriptions, billing history, and adjustments.</p></div>
          <OperatorRefresh label="Refresh agencies" busy={agencies.isFetching} onClick={() => void agencies.refetch()} />
        </div>
        <form className="flex flex-wrap gap-2 px-5 pb-5 sm:px-7" role="search" aria-label="Agency search" onSubmit={event => {
          event.preventDefault()
          const nextSearch = input.trim()
          setSearch(nextSearch); setSelected(null)
          if (nextSearch === search) void agencies.refetch()
        }}>
          <label className="relative min-w-0 flex-1"><span className="sr-only">Agency name</span><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-ink-soft" /><input className={`${operatorInput} pl-10`} placeholder="Search by agency name…" maxLength={100} value={input} onChange={event => setInput(event.target.value)} /></label>
          <button type="submit" className={operatorPrimaryButton}>Search<ArrowRight size={15} aria-hidden="true" /></button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-ink/10 bg-cream/50 px-5 py-3 text-xs text-ink-soft sm:px-7">
          <span>{search ? <>Results for “{search}”</> : 'All agencies'}</span>
          {agencies.isSuccess && <span>{agencyRows.length} {agencyRows.length === 1 ? 'agency' : 'agencies'}{agencies.hasNextPage ? ' loaded · More available' : ''}</span>}
          {search && <button type="button" className="font-medium underline underline-offset-4" onClick={() => { setInput(''); setSearch(''); setSelected(null) }}>Clear search</button>}
        </div>
        {agencies.isPending && <p role="status" className="p-7 text-sm text-ink-soft">Loading agencies…</p>}
        {agencies.isError && <p role="alert" className="m-5 rounded-lg bg-orange-soft p-4 text-sm">Could not load agencies. Refresh to retry.</p>}
        {!agencies.isError && <ul className="divide-y divide-ink/10">{agencyRows.map(agency => <li key={agency.id}>
          <button type="button" className={`group flex min-h-24 w-full items-center gap-3 px-5 py-5 text-left transition-colors hover:bg-cream/80 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink sm:gap-4 sm:px-7 ${selected === agency.id ? 'bg-mint-soft/50' : ''}`} onClick={() => selectAgency(agency.id)} aria-pressed={selected === agency.id} aria-label={`Open billing for ${agency.name}`}>
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-cream"><Building2 size={21} strokeWidth={1.5} /></span>
            <span className="min-w-0 flex-1"><span className="block break-words font-medium">{agency.name}</span><span className="mt-1.5 flex flex-wrap gap-2"><OperatorBadge tone={['active', 'trialing'].includes(agency.subscription_status ?? '') ? 'success' : ['past_due', 'unpaid', 'incomplete'].includes(agency.subscription_status ?? '') ? 'attention' : 'neutral'}>{agency.subscription_status ? agency.subscription_status.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase()) : 'No subscription'}</OperatorBadge>{agency.deleted_at && <OperatorBadge>Archived</OperatorBadge>}</span></span>
            <span className="hidden text-xs text-ink-soft sm:inline">View billing</span><ArrowRight size={17} aria-hidden="true" className="shrink-0 transition-transform group-hover:translate-x-1" />
          </button>
        </li>)}</ul>}
        {agencies.isSuccess && agencyRows.length === 0 && <div className="px-7 py-10 text-center"><Search size={24} aria-hidden="true" className="mx-auto mb-3 text-ink-soft" /><p className="font-medium">{search ? 'No agencies match your search.' : 'No agencies yet.'}</p><p className="mt-2 text-sm text-ink-soft">{search ? 'Try another name or clear your search.' : 'Agency accounts will appear here when they are created.'}</p></div>}
        {agencies.hasNextPage && <div className="border-t border-ink/10 p-4 text-center"><button className={operatorButton} disabled={agencies.isFetching} onClick={() => void agencies.fetchNextPage()}>{agencies.isFetchingNextPage ? 'Loading…' : 'Load more agencies'}<ArrowDown size={14} aria-hidden="true" /></button></div>}
        <div className="flex items-start gap-3 border-t border-ink/10 bg-cream/30 px-5 py-5 sm:px-7"><LockKeyhole size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-soft" /><p className="text-xs leading-5 text-ink-soft">Select an agency to open its billing workspace. Actions that change billing require review and confirmation.</p></div>
      </section>
      <aside aria-label="Billing attention queues" className="min-w-0 space-y-5"><OperatorWebhookAlerts /><OperatorBillingReviews onSelect={selectAgency} /></aside>
    </div>
    {selected && <div ref={detailRef} tabIndex={-1} aria-label="Selected agency billing" className="mt-8 scroll-mt-6 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4">
      <button className={`${operatorButton} mb-4`} onClick={closeAgency}><ArrowLeft size={15} aria-hidden="true" />Back to agencies</button>
      <OperatorAgencyPanel key={selected} org={selected} access={access} />
    </div>}
    <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-ink/10 pt-5 text-xs text-ink-soft"><span>Care Harbor · Billing operations</span><span>Message and question queues refresh every minute.</span></footer>
  </>
}
