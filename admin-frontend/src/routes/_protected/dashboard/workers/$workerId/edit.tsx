import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { orgMembersApi, type OrgMember, type EmploymentType, EMPLOYMENT_TYPE_LABELS } from '@/features/org-members/api'
import { WorkerAvailabilityEditor } from '@/features/org-members/components/WorkerAvailabilityEditor'
import { Avatar, DateInput, Kicker } from '@/shared/components/ui'
import { WorkerDocumentsTab } from '@/features/workers/components/WorkerDocumentsTab'
import { WorkerDangerZone } from '@/features/workers/components/WorkerDangerZone'
import { useWorkerCredentials } from '@/features/workers/hooks/useWorkerCredentials'
import { validatePhone, formatPhone } from '@/shared/lib/phone'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId/edit')({
  component: WorkerEditPage,
})

// ── Loading gate ───────────────────────────────────────────────────────────────

function WorkerEditPage() {
  const { workerId } = Route.useParams()
  const { data: worker, isLoading, isError } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => orgMembersApi.getOrgMember(workerId),
  })

  if (isLoading) return <div className="p-10 font-mono text-[11px] text-muted">Loading…</div>
  if (isError || !worker) return <div className="p-10 font-mono text-[11px] text-orange">Worker not found.</div>

  return <WorkerEditForm worker={worker} />
}

// ── Shared field styles ────────────────────────────────────────────────────────

const labelCls  = 'flex items-center gap-1 font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1.5'
const inputCls  = 'w-full bg-paper border border-ink px-3 py-2.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ink'
const selectCls = `${inputCls} appearance-none font-mono`

function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mt-1 font-mono text-[10px] text-orange">{error as string}</p>
}

// ── Section card ───────────────────────────────────────────────────────────────

function FormCard({
  id,
  num,
  kicker,
  title,
  helper,
  children,
  cardRef,
}: {
  id: string
  num: string
  kicker: string
  title: string
  helper: string
  children: React.ReactNode
  cardRef: (el: HTMLElement | null) => void
}) {
  return (
    <section
      id={id}
      ref={cardRef}
      className="border border-ink bg-paper scroll-mt-14"
    >
      <div className="px-7 pt-[22px] pb-[18px] border-b border-line-soft">
        <Kicker leader className="mb-[10px]">{num} — {kicker}</Kicker>
        <h3 className="font-serif text-[22px] tracking-[-0.02em] leading-none">{title}</h3>
        <p className="text-[12.5px] text-ink-soft mt-[7px] max-w-[520px]">{helper}</p>
      </div>
      <div className="p-7">{children}</div>
    </section>
  )
}

// ── Full edit form ─────────────────────────────────────────────────────────────

type SectionId = 'personal' | 'employment' | 'compliance' | 'danger'

const SECTIONS: Array<{ id: SectionId; num: string; label: string }> = [
  { id: 'personal',    num: '01', label: 'Personal info' },
  { id: 'employment',  num: '02', label: 'Employment' },
  { id: 'compliance',  num: '03', label: 'Compliance documents' },
  { id: 'danger',      num: '04', label: 'Danger zone' },
]

function WorkerEditForm({ worker }: { worker: OrgMember }) {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [serverError, setServerError]     = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionId>('personal')

  const sectionEls = useRef<Record<SectionId, HTMLElement | null>>({
    personal: null, employment: null, compliance: null, danger: null,
  })

  // Scroll-spy via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id as SectionId)
        }
      },
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 },
    )
    for (const el of Object.values(sectionEls.current)) {
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  // The last section never reaches the top detection band — force it active at bottom of page
  useEffect(() => {
    function onScroll() {
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 100) {
        setActiveSection('danger')
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Credentials for the compliance mini-status widget
  const { data: credentials = [] } = useWorkerCredentials(worker.id)
  const credValidCount = credentials.filter((c) => c.verified_at && (!c.expiry_date || new Date(c.expiry_date) >= new Date())).length
  const credNeedsAttention = credentials.filter((c) => {
    if (!c.file_url) return false
    if (!c.verified_at) return true
    if (c.expiry_date && new Date(c.expiry_date) < new Date()) return true
    return false
  }).length

  // Consolidated form — covers personal info + employment
  const form = useForm({
    defaultValues: {
      first_name:                     worker.first_name,
      last_name:                      worker.last_name,
      phone_number:                   worker.phone_number ?? '',
      gender:                         worker.gender ?? '',
      date_of_birth:                  worker.date_of_birth?.slice(0, 10) ?? '',
      hire_date:                      worker.hire_date?.slice(0, 10) ?? '',
      street:                         worker.street ?? '',
      city:                           worker.city ?? '',
      province:                       worker.province ?? '',
      postal_code:                    worker.postal_code ?? '',
      emergency_contact_name:         worker.emergency_contact_name ?? '',
      emergency_contact_phone:        worker.emergency_contact_phone ?? '',
      emergency_contact_relationship: worker.emergency_contact_relationship ?? '',
      is_active:                      worker.is_active,
      employment_type:                (worker.employment_type ?? '') as EmploymentType | '',
      max_hours_per_week:             worker.max_hours_per_week?.toString() ?? '',
      has_vehicle:                    worker.has_vehicle ?? false,
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        const maxHours = value.max_hours_per_week ? parseInt(value.max_hours_per_week, 10) : undefined
        await orgMembersApi.updateOrgMember(worker.id, {
          first_name:                     value.first_name,
          last_name:                      value.last_name,
          phone_number:                   value.phone_number || undefined,
          gender:                         value.gender || undefined,
          date_of_birth:                  value.date_of_birth || undefined,
          hire_date:                      value.hire_date || undefined,
          street:                         value.street || undefined,
          city:                           value.city || undefined,
          province:                       value.province || undefined,
          postal_code:                    value.postal_code || undefined,
          emergency_contact_name:         value.emergency_contact_name || undefined,
          emergency_contact_phone:        value.emergency_contact_phone || undefined,
          emergency_contact_relationship: value.emergency_contact_relationship || undefined,
          is_active:                      value.is_active,
          employment_type:                (value.employment_type as EmploymentType) || undefined,
          max_hours_per_week:             isNaN(maxHours as number) ? undefined : maxHours,
          has_vehicle:                    value.has_vehicle,
        })
        queryClient.invalidateQueries({ queryKey: ['worker', worker.id] })
        queryClient.invalidateQueries({ queryKey: ['workers'] })
        navigate({ to: '/dashboard/workers/$workerId', params: { workerId: worker.id } })
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  const initials = `${worker.first_name[0] ?? ''}${worker.last_name[0] ?? ''}`.toUpperCase()

  function scrollTo(id: SectionId) {
    sectionEls.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-cream">

      {/* ── Sticky action bar ────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-3 border-b border-ink bg-cream">
        <Link
          to="/dashboard/workers/$workerId"
          params={{ workerId: worker.id } as never}
          className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink flex items-center gap-1.5"
        >
          ← Back to {worker.first_name} {worker.last_name}
        </Link>
        <div className="flex items-center gap-3.5">
          <form.Subscribe selector={(s) => s.isDirty}>
            {(isDirty) => isDirty ? (
              <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] uppercase text-orange">
                <span className="w-1.5 h-1.5 rounded-full bg-orange" />
                Unsaved changes
              </span>
            ) : null}
          </form.Subscribe>
          <Link
            to="/dashboard/workers/$workerId"
            params={{ workerId: worker.id } as never}
            className="rounded-full border border-ink px-4 py-2 font-mono text-[12px] bg-transparent text-ink hover:bg-cream-2 transition-colors"
          >
            Cancel
          </Link>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button
                type="button"
                onClick={() => form.handleSubmit()}
                disabled={isSubmitting}
                className="rounded-full bg-ink text-cream border border-ink px-4 py-2 font-mono text-[12px] hover:opacity-80 disabled:opacity-40 transition-opacity"
              >
                {isSubmitting ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </form.Subscribe>
        </div>
      </div>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-7 flex items-end justify-between">
        <div className="flex items-center gap-[18px]">
          <Avatar initials={initials} color="c1" size="xl" />
          <div>
            <Kicker leader className="mb-2">Workers — Edit profile</Kicker>
            <h1 className="font-serif text-[40px] leading-[0.98] font-medium tracking-[-0.02em]">
              Edit <em>{worker.first_name} {worker.last_name}</em>
            </h1>
          </div>
        </div>

        {/* is_active toggle — promoted to page header */}
        <form.Field name="is_active">
          {(field) => (
            <div className="flex items-center gap-2.5 pb-1.5">
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft">Status</span>
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
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-muted">
                {field.state.value ? 'Active' : 'Inactive'}
              </span>
            </div>
          )}
        </form.Field>
      </div>

      {/* ── Two-column body ──────────────────────────────────────────── */}
      <div className="px-8 flex gap-10 items-start pb-16">

        {/* Section nav (sticky) */}
        <div className="w-[200px] shrink-0 sticky top-[49px] self-start">
          <Kicker className="mb-3.5">On this page</Kicker>
          <div className="flex flex-col">
            {SECTIONS.map(({ id, num, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollTo(id)}
                className={`flex gap-2.5 px-3 py-2.5 font-mono text-[11px] tracking-[0.04em] border-l-2 text-left transition-colors ${
                  activeSection === id
                    ? 'border-l-ink bg-cream-2 text-ink'
                    : 'border-l-transparent text-ink-soft hover:text-ink'
                }`}
              >
                <span className="opacity-50">{num}</span>{label}
              </button>
            ))}
          </div>

          {/* Compliance mini-status */}
          <div className="mt-6">
            <Kicker className="mb-2.5">Compliance</Kicker>
            <div className="border border-ink bg-paper p-3.5">
              <p className="font-serif text-[24px] font-medium leading-none">
                {credValidCount}
                <span className="text-[13px] text-muted">/{10}</span>
              </p>
              {credNeedsAttention > 0 ? (
                <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-orange mt-1">
                  {credNeedsAttention} need{credNeedsAttention === 1 ? 's' : ''} attention
                </p>
              ) : (
                <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-muted mt-1">All clear</p>
              )}
            </div>
          </div>
        </div>

        {/* Form sections */}
        <form
          className="flex-1 min-w-0 max-w-[760px] flex flex-col gap-6"
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
        >

          {/* ── 01 Personal info ───────────────────────────────────── */}
          <FormCard
            id="personal"
            num="01"
            kicker="Identity"
            title="Personal information"
            helper="Name and contact details, shown across schedules, timesheets and the roster."
            cardRef={(el) => { sectionEls.current.personal = el }}
          >
            <div className="grid grid-cols-2 gap-[18px]">
              <form.Field name="first_name" validators={{ onChange: ({ value }) => value.trim() ? undefined : 'Required' }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>First name <span className="text-orange">*</span></label>
                    <input className={inputCls} value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                    <FieldError error={field.state.meta.errors[0]} />
                  </div>
                )}
              </form.Field>
              <form.Field name="last_name" validators={{ onChange: ({ value }) => value.trim() ? undefined : 'Required' }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>Last name <span className="text-orange">*</span></label>
                    <input className={inputCls} value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                    <FieldError error={field.state.meta.errors[0]} />
                  </div>
                )}
              </form.Field>
              <form.Field name="phone_number" validators={{ onBlur: ({ value }) => validatePhone(value) }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input className={`${inputCls} font-mono`} value={field.state.value}
                      onChange={(e) => field.handleChange(formatPhone(e.target.value))} onBlur={field.handleBlur}
                      placeholder="604 555 1234" />
                    <FieldError error={field.state.meta.errors[0]} />
                  </div>
                )}
              </form.Field>
              <form.Field name="gender">
                {(field) => (
                  <div>
                    <label className={labelCls}>Gender</label>
                    <select className={selectCls} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)}>
                      <option value="">Select…</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="non_binary">Non-binary</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                )}
              </form.Field>
              <form.Field name="date_of_birth">
                {(field) => (
                  <div>
                    <label className={labelCls}>Date of birth</label>
                    <DateInput value={field.state.value} onChange={(v) => field.handleChange(v)} className="w-full" />
                  </div>
                )}
              </form.Field>
              <form.Field name="hire_date">
                {(field) => (
                  <div>
                    <label className={labelCls}>Hire date</label>
                    <DateInput value={field.state.value} onChange={(v) => field.handleChange(v)} className="w-full" />
                  </div>
                )}
              </form.Field>
            </div>

            {/* Address subsection */}
            <div className="border-t border-dashed border-line-soft pt-[18px] mt-[22px]">
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-muted mb-[14px]">Address</p>
              <form.Field name="street">
                {(field) => (
                  <div className="mb-[18px]">
                    <label className={labelCls}>Street</label>
                    <input className={inputCls} value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)} placeholder="123 Main St" />
                  </div>
                )}
              </form.Field>
              <div className="grid grid-cols-[1fr_120px_130px] gap-[18px]">
                <form.Field name="city">
                  {(field) => (
                    <div>
                      <label className={labelCls}>City</label>
                      <input className={inputCls} value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)} placeholder="Vancouver" />
                    </div>
                  )}
                </form.Field>
                <form.Field name="province">
                  {(field) => (
                    <div>
                      <label className={labelCls}>Province</label>
                      <select className={selectCls} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)}>
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
                      <label className={labelCls}>Postal code</label>
                      <input className={`${inputCls} font-mono`} value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)} placeholder="V6B 1A1" />
                    </div>
                  )}
                </form.Field>
              </div>
            </div>

            {/* Emergency contact subsection */}
            <div className="border-t border-dashed border-line-soft pt-[18px] mt-[22px]">
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-muted mb-[14px]">Emergency contact</p>
              <form.Field name="emergency_contact_name">
                {(field) => (
                  <div className="mb-[18px]">
                    <label className={labelCls}>Full name</label>
                    <input className={inputCls} value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)} placeholder="Full name" />
                  </div>
                )}
              </form.Field>
              <div className="grid grid-cols-2 gap-[18px]">
                <form.Field name="emergency_contact_phone" validators={{ onBlur: ({ value }) => validatePhone(value) }}>
                  {(field) => (
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input className={`${inputCls} font-mono`} value={field.state.value}
                        onChange={(e) => field.handleChange(formatPhone(e.target.value))} onBlur={field.handleBlur}
                        placeholder="604 555 1234" />
                      <FieldError error={field.state.meta.errors[0]} />
                    </div>
                  )}
                </form.Field>
                <form.Field name="emergency_contact_relationship">
                  {(field) => (
                    <div>
                      <label className={labelCls}>Relationship</label>
                      <input className={inputCls} value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)} placeholder="Spouse, Parent…" />
                    </div>
                  )}
                </form.Field>
              </div>
            </div>
          </FormCard>

          {/* ── 02 Employment & availability ───────────────────────── */}
          <FormCard
            id="employment"
            num="02"
            kicker="Logistics"
            title="Employment & availability"
            helper="Employment terms, whether they can drive to visits, and the hours they're available to work."
            cardRef={(el) => { sectionEls.current.employment = el }}
          >
            <div className="grid grid-cols-2 gap-[18px] mb-[18px]">
              <form.Field name="employment_type">
                {(field) => (
                  <div>
                    <label className={labelCls}>Employment type</label>
                    <select className={selectCls} value={field.state.value}
                      onChange={(e) => {
                        const val = e.target.value as EmploymentType | ''
                        field.handleChange(val)
                        if (val === 'full_time') form.setFieldValue('max_hours_per_week', '30')
                        else if (val === 'part_time') form.setFieldValue('max_hours_per_week', '24')
                      }}>
                      <option value="">Select…</option>
                      {(Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, string][]).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </form.Field>
              <form.Subscribe selector={(s) => s.values.employment_type}>
                {(empType) => {
                  const min = empType === 'full_time' ? 30 : 1
                  const max = empType === 'full_time' ? 40 : 29
                  const hint = empType === 'full_time' ? '30–40 hrs/week' : empType === 'part_time' ? 'Up to 29 hrs/week' : 'Used to flag over-scheduling.'
                  return (
                    <form.Field name="max_hours_per_week">
                      {(field) => (
                        <div>
                          <label className={labelCls}>Max hours / week</label>
                          <input type="number" min={min} max={max} className={`${inputCls} font-mono`}
                            value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder={String(min)} />
                          <p className="font-mono text-[9px] text-muted mt-[5px]">{hint}</p>
                        </div>
                      )}
                    </form.Field>
                  )
                }}
              </form.Subscribe>
            </div>

            <form.Field name="has_vehicle">
              {(field) => (
                <label className="flex items-center gap-2.5 cursor-pointer mb-[22px]">
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
                  <span className="font-mono text-[11px] tracking-[0.06em] uppercase text-ink-soft">Has a vehicle</span>
                </label>
              )}
            </form.Field>

            <div className="border-t border-dashed border-line-soft pt-[18px]">
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-muted mb-[14px]">Weekly availability</p>
              <WorkerAvailabilityEditor memberId={worker.id} />
            </div>
          </FormCard>

          {/* ── 03 Compliance documents ─────────────────────────────── */}
          <section
            id="compliance"
            ref={(el) => { sectionEls.current.compliance = el }}
            className="border border-ink bg-paper scroll-mt-14"
          >
            <div className="px-7 pt-[22px] pb-[18px] border-b border-line-soft">
              <Kicker leader className="mb-[10px]">03 — Credentials</Kicker>
              <h3 className="font-serif text-[22px] tracking-[-0.02em] leading-none">Compliance documents</h3>
              <p className="text-[12.5px] text-ink-soft mt-[7px] max-w-[520px]">
                Every credential, ordered by what needs attention first. Expired and unreviewed documents surface at the top.
              </p>
            </div>
            <div className="p-7">
              <WorkerDocumentsTab workerId={worker.id} />
            </div>
          </section>

          {/* ── 04 Danger zone ──────────────────────────────────────── */}
          <div
            id="danger"
            ref={(el) => { sectionEls.current.danger = el }}
            className="scroll-mt-14"
          >
            <WorkerDangerZone worker={worker} />
          </div>

          {serverError && (
            <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
          )}
        </form>
      </div>
    </div>
  )
}
