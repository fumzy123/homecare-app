import type { OrgMember } from '@/features/org-members/api'

// Layer 2: an assignment indicator, separate from the employment label.
export function WorkerSchedulingStatus({ worker }: { worker: Pick<OrgMember, 'is_active' | 'on_standby' | 'next_shift_at'> }) {
  if (!worker.is_active) return null
  return <div className="mt-2 font-mono text-[10px] leading-relaxed text-ink-soft">
    {worker.on_standby && <p title="No ongoing shift or scheduled client visit in the next 14 days.">On standby</p>}
    <p>{worker.next_shift_at ? `Next shift ${new Date(worker.next_shift_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'No upcoming shift'}</p>
  </div>
}
