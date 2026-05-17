import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { orgMembersApi, type OrgMember, type EmploymentType, EMPLOYMENT_TYPE_LABELS } from '@/features/org-members/api'
import { AvailabilityGrid, type ScheduleMap } from '@/shared/components/AvailabilityGrid'
import { Kicker } from '@/shared/components/ui'

const labelClass  = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass  = 'w-full bg-paper border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'
const selectClass = `${inputClass} appearance-none`

export function WorkerProfileForm({ worker }: { worker: OrgMember }) {
  const queryClient = useQueryClient()
  const [saved, setSaved]             = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      street:             worker.street ?? '',
      city:               worker.city ?? '',
      province:           worker.province ?? '',
      postal_code:        worker.postal_code ?? '',
      employment_type:    (worker.employment_type ?? '') as EmploymentType | '',
      has_vehicle:        worker.has_vehicle ?? false,
      max_hours_per_week: worker.max_hours_per_week?.toString() ?? '',
      availability:       (worker.availability ?? {}) as ScheduleMap,
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      setSaved(false)
      try {
        const maxHours = value.max_hours_per_week ? parseInt(value.max_hours_per_week, 10) : undefined
        await orgMembersApi.updateOrgMember(worker.id, {
          street:             value.street || undefined,
          city:               value.city || undefined,
          province:           value.province || undefined,
          postal_code:        value.postal_code || undefined,
          employment_type:    (value.employment_type as EmploymentType) || undefined,
          has_vehicle:        value.has_vehicle,
          max_hours_per_week: isNaN(maxHours as number) ? undefined : maxHours,
          availability:       Object.keys(value.availability).length > 0 ? value.availability : undefined,
        })
        queryClient.invalidateQueries({ queryKey: ['worker', worker.id] })
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  return (
    <section className="border border-ink bg-paper">
      <div className="px-6 py-4 border-b border-ink">
        <Kicker>Work profile</Kicker>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }} className="px-6 py-6 space-y-4">
        <div>
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-4">Address</p>
          <form.Field name="street">
            {(field) => (
              <div className="mb-4">
                <label className={labelClass}>Street</label>
                <input className={inputClass} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} placeholder="123 Main St" />
              </div>
            )}
          </form.Field>
          <div className="grid grid-cols-[1fr_120px_120px] gap-4">
            <form.Field name="city">
              {(field) => (
                <div>
                  <label className={labelClass}>City</label>
                  <input className={inputClass} value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)} placeholder="Vancouver" />
                </div>
              )}
            </form.Field>
            <form.Field name="province">
              {(field) => (
                <div>
                  <label className={labelClass}>Province</label>
                  <select className={selectClass} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)}>
                    <option value="">—</option>
                    {['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}
            </form.Field>
            <form.Field name="postal_code">
              {(field) => (
                <div>
                  <label className={labelClass}>Postal Code</label>
                  <input className={inputClass} value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)} placeholder="V6B 1A1" />
                </div>
              )}
            </form.Field>
          </div>
        </div>

        <div className="border-t border-dashed border-line-soft pt-4">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-4">Employment</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <form.Field name="employment_type">
              {(field) => (
                <div>
                  <label className={labelClass}>Employment Type</label>
                  <select className={selectClass} value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value as EmploymentType | '')}>
                    <option value="">Select…</option>
                    {(Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              )}
            </form.Field>
            <form.Field name="max_hours_per_week">
              {(field) => (
                <div>
                  <label className={labelClass}>Max Hours / Week</label>
                  <input type="number" min={0} max={80} className={inputClass}
                    value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="40" />
                </div>
              )}
            </form.Field>
          </div>
          <form.Field name="has_vehicle">
            {(field) => (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.state.value}
                  onClick={() => field.handleChange(!field.state.value)}
                  className={`relative inline-flex h-5 w-9 items-center border transition-colors ${
                    field.state.value ? 'bg-ink border-ink' : 'bg-cream-2 border-line-soft'
                  }`}
                >
                  <span className={`inline-block h-3 w-3 bg-cream transition-transform ${
                    field.state.value ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </button>
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft">Has a vehicle</span>
              </label>
            )}
          </form.Field>
        </div>

        <div className="border-t border-dashed border-line-soft pt-4">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-4">Availability</p>
          <form.Field name="availability">
            {(field) => (
              <AvailabilityGrid value={field.state.value} onChange={(v) => field.handleChange(v)} />
            )}
          </form.Field>
        </div>

        {serverError && (
          <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
        )}

        <div className="flex items-center justify-end gap-4 pt-2">
          {saved && <span className="font-mono text-[10px] text-mint tracking-wide uppercase">Saved ✓</span>}
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button type="submit" disabled={isSubmitting}
                className="bg-ink text-cream px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </section>
  )
}
