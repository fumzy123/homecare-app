import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuthStore } from '@/shared/stores/auth'
import { ApiError } from '@/shared/lib/api-client'
import { BillingDialog } from '@/shared/components/BillingDialog'
import type { BillingStatus } from '../api'
import { useBillingOnboarding } from '../hooks/useBillingOnboarding'
import { useBillingPlan } from '../hooks/useBillingPlan'
import { SubscriptionPlans } from './SubscriptionPlans'

const money = (value: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value / 100)
const date = (value: number) => new Date(value * 1000).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })

export function CompareBillingPlans({ status }: { status: BillingStatus }) {
  const user = useAuthStore(s => s.user)
  const { options } = useBillingOnboarding(user?.id, user?.role === 'owner')
  const { preview, change, pending, cancel } = useBillingPlan(user?.role === 'owner' ? user.id : undefined)
  const [interval, setInterval] = useState<'month' | 'year'>(status.plan_interval ?? 'month')
  const [confirming, setConfirming] = useState(false)
  const error = preview.error ?? change.error ?? options.error ?? pending.error ?? cancel.error
  if (user?.role !== 'owner') return <p>Your agency owner manages subscription changes.</p>
  return <div className="space-y-6">
    <p className="text-sm">Current plan: <strong>{status.plan_code === 'founding' ? 'Founding' : 'Standard'} · {status.plan_interval === 'year' ? 'Annual' : 'Monthly'}</strong></p>
    {options.data && <SubscriptionPlans plans={options.data.plans} interval={interval} onChange={setInterval} disabled={preview.isPending || change.isPending || Boolean(pending.data?.pending)} />}
    {options.isPending && <p>Loading plans…</p>}
    {pending.data?.pending ? <div className="space-y-3"><p role="status">Switching to {pending.data.pending.interval === 'year' ? 'annual' : 'monthly'} billing on {date(pending.data.pending.effective_at)}.</p><button className="text-sm underline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>Keep current plan instead</button></div>
      : status.plan_code === 'founding' ? <p>Your Founding offer keeps its protected monthly pricing.</p>
        : <button disabled={interval === status.plan_interval || preview.isPending || change.isPending || pending.isPending || pending.isError || status.billing_canceled}
            className="rounded-lg bg-ink px-6 py-3 text-paper disabled:opacity-40" onClick={() => preview.mutate(interval, { onSuccess: () => setConfirming(true) })}>
            {preview.isPending ? 'Checking…' : interval === status.plan_interval ? 'Current plan' : 'Review change'}
          </button>}
    {change.isSuccess && !confirming && <p role="status">{change.data.scheduled ? 'Your change is scheduled for renewal.' : 'Plan updated. Your trial end date is unchanged.'}</p>}
    {error && <p role="alert" className="text-orange">{error instanceof ApiError ? error.message : 'Could not load the plan change. Please try again.'}</p>}
    <p><Link to="/settings/billing" className="text-sm underline">Payment methods, invoices and cancellation</Link></p>
    {confirming && preview.data && <BillingDialog title="Confirm plan change" busy={change.isPending} onClose={() => setConfirming(false)}>
      <div className="space-y-5"><p>{money(preview.data.base_amount_cents)} CAD / {preview.data.interval === 'year' ? 'year' : 'month'} starting {date(preview.data.effective_at)}.</p>
        <p>{preview.data.included_clients} active clients included, then {money(preview.data.additional_client_amount_cents)} per additional client per month.</p>
        <p>Nothing due today. Your remaining trial or prepaid access is kept. Additional usage is calculated monthly and collected {interval === 'year' ? 'at year-end' : 'monthly'}, plus applicable tax.</p>
        {preview.data.interval === 'year' && <p>Annual prepayment covers the base only and is non-refundable.</p>}
        {change.isError && <p role="alert" className="text-orange">{change.error instanceof ApiError ? change.error.message : 'Could not change your plan. Please try again.'}</p>}
        <button disabled={change.isPending} className="rounded-lg bg-ink px-5 py-3 text-paper disabled:opacity-40" onClick={() => change.mutate(preview.data!, { onSuccess: () => setConfirming(false) })}>{change.isPending ? 'Saving…' : 'Confirm change'}</button>
      </div>
    </BillingDialog>}
  </div>
}
