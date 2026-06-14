import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clientsApi, SERVICE_TYPE_LABELS, type Client, type ClientStatus } from '@/features/clients/api'
import { ClientDangerZone } from '@/features/clients/components/ClientDangerZone'
import { Avatar, DateInput, Kicker } from '@/shared/components/ui'
import { validatePhone, formatPhone } from '@/shared/lib/phone'
import { format } from 'date-fns'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/edit')({
  component: ClientEditPage,
})

function ClientEditPage() {
  const { clientId } = Route.useParams()
  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['client', clientId],
    queryFn:  () => clientsApi.getClient(clientId),
  })

  if (isLoading) return <div className="p-10 font-mono text-[11px] text-muted">Loading…</div>
  if (isError || !client) return <div className="p-10 font-mono text-[11px] text-orange">Failed to load client.</div>

  return <ClientEditForm client={client} />
}

// ── Shared field styles ────────────────────────────────────────────────────────

const labelCls  = 'flex items-center gap-1 font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1.5'
const inputCls  = 'w-full bg-paper border border-ink px-3 py-2.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ink'
const selectCls = `${inputCls} appearance-none font-mono`

function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mt-1 font-mono text-[10px] text-orange">{error as string}</p>
}

function FormCard({
  id, num, kicker, title, helper, children, cardRef,
}: {
  id: string; num: string; kicker: string; title: string; helper: string
  children: React.ReactNode; cardRef: (el: HTMLElement | null) => void
}) {
  return (
    <section id={id} ref={cardRef} className="border border-ink bg-paper scroll-mt-14">
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

type SectionId = 'identity' | 'contact' | 'emergency' | 'care' | 'danger'

const SECTIONS: Array<{ id: SectionId; num: string; label: string }> = [
  { id: 'identity',  num: '01', label: 'Identity' },
  { id: 'contact',   num: '02', label: 'Contact & address' },
  { id: 'emergency', num: '03', label: 'Emergency contact' },
  { id: 'care',      num: '04', label: 'Care profile' },
  { id: 'danger',    num: '05', label: 'Danger zone' },
]

const PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']

function ClientEditForm({ client }: { client: Client }) {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [serverError, setServerError]     = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionId>('identity')

  const sectionEls = useRef<Record<SectionId, HTMLElement | null>>({
    identity: null, contact: null, emergency: null, care: null, danger: null,
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

  useEffect(() => {
    function onScroll() {
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 100) {
        setActiveSection('danger')
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const form = useForm({
    defaultValues: {
      first_name:                     client.first_name,
      last_name:                      client.last_name,
      date_of_birth:                  client.date_of_birth?.slice(0, 10) ?? '',
      gender:                         client.gender ?? '',
      phone_number:                   client.phone_number ?? '',
      email:                          client.email ?? '',
      street:                         client.street,
      city:                           client.city,
      province:                       client.province,
      postal_code:                    client.postal_code,
      emergency_contact_name:         client.emergency_contact_name,
      emergency_contact_phone:        client.emergency_contact_phone,
      emergency_contact_relationship: client.emergency_contact_relationship,
      medical_conditions:             client.medical_conditions ?? '',
      allergies:                      client.allergies ?? '',
      medications:                    client.medications ?? '',
      special_instructions:           client.special_instructions ?? '',
      notes:                          client.notes ?? '',
      status:                         client.status,
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await clientsApi.updateClient(client.id, {
          first_name:           value.first_name,
          last_name:            value.last_name,
          date_of_birth:        value.date_of_birth,
          gender:               value.gender || undefined,
          phone_number:         value.phone_number || undefined,
          email:                value.email || undefined,
          street:               value.street,
          city:                 value.city,
          province:             value.province,
          postal_code:          value.postal_code,
          emergency_contact_name:         value.emergency_contact_name,
          emergency_contact_phone:        value.emergency_contact_phone,
          emergency_contact_relationship: value.emergency_contact_relationship,
          medical_conditions:   value.medical_conditions || undefined,
          allergies:            value.allergies || undefined,
          medications:          value.medications || undefined,
          special_instructions: value.special_instructions || undefined,
          notes:                value.notes || undefined,
          status:               value.status,
        })
        queryClient.invalidateQueries({ queryKey: ['client', client.id] })
        queryClient.invalidateQueries({ queryKey: ['clients'] })
        navigate({ to: '/dashboard/clients/$clientId', params: { clientId: client.id } })
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  const initials = `${client.first_name[0] ?? ''}${client.last_name[0] ?? ''}`.toUpperCase()

  function scrollTo(id: SectionId) {
    sectionEls.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-cream">

      {/* ── Sticky action bar ────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-3 border-b border-ink bg-cream">
        <Link to="/dashboard/clients/$clientId" params={{ clientId: client.id } as never}
          className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink flex items-center gap-1.5">
          ← Back to {client.first_name} {client.last_name}
        </Link>
        <div className="flex items-center gap-3.5">
          <form.Subscribe selector={(s) => s.isDirty}>
            {(isDirty) => isDirty ? (
              <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] uppercase text-orange">
                <span className="w-1.5 h-1.5 rounded-full bg-orange" /> Unsaved changes
              </span>
            ) : null}
          </form.Subscribe>
          <Link to="/dashboard/clients/$clientId" params={{ clientId: client.id } as never}
            className="rounded-full border border-ink px-4 py-2 font-mono text-[12px] bg-transparent text-ink hover:bg-cream-2 transition-colors">
            Cancel
          </Link>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <button type="button" onClick={() => form.handleSubmit()} disabled={isSubmitting}
                className="rounded-full bg-ink text-cream border border-ink px-4 py-2 font-mono text-[12px] hover:opacity-80 disabled:opacity-40 transition-opacity">
                {isSubmitting ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </form.Subscribe>
        </div>
      </div>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-7 flex items-end justify-between">
        <div className="flex items-center gap-[18px]">
          <Avatar initials={initials} color="c2" size="xl" />
          <div>
            <Kicker leader className="mb-2">Clients — Edit profile</Kicker>
            <h1 className="font-serif text-[40px] leading-[0.98] font-medium tracking-[-0.02em]">
              Edit <em>{client.first_name} {client.last_name}</em>
            </h1>
          </div>
        </div>

        {/* Status — promoted to page header */}
        <form.Field name="status">
          {(field) => (
            <div className="flex items-center gap-2.5 pb-1.5">
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft">Status</span>
              <select
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value as ClientStatus)}
                className="appearance-none bg-paper border border-ink px-3 py-1.5 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-ink"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="discharged">Discharged</option>
              </select>
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
              <button key={id} type="button" onClick={() => scrollTo(id)}
                className={`flex gap-2.5 px-3 py-2.5 font-mono text-[11px] tracking-[0.04em] border-l-2 text-left transition-colors ${
                  activeSection === id ? 'border-l-ink bg-cream-2 text-ink' : 'border-l-transparent text-ink-soft hover:text-ink'
                }`}>
                <span className="opacity-50">{num}</span>{label}
              </button>
            ))}
          </div>

          {/* Boundary note: funding lives elsewhere */}
          <div className="mt-[18px] px-3 py-3 border border-dashed border-line-soft bg-paper">
            <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-ink-soft mb-1.5">Not edited here</p>
            <p className="text-[11.5px] text-ink-soft leading-[1.5]">
              Authorizations &amp; the care plan are managed in the <strong>Authorization</strong> tab — they follow the funder's lifecycle, not the profile's.
            </p>
          </div>
        </div>

        {/* Form sections */}
        <form className="flex-1 min-w-0 max-w-[720px] flex flex-col gap-6"
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>

          {/* ── 01 Identity ────────────────────────────────────────── */}
          <FormCard id="identity" num="01" kicker="Identity" title="Personal information"
            helper="Legal name and demographics. Shown across the schedule, visits and billing."
            cardRef={(el) => { sectionEls.current.identity = el }}>
            <div className="grid grid-cols-2 gap-[18px]">
              <form.Field name="first_name" validators={{ onChange: ({ value }) => value.trim() ? undefined : 'Required' }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>First name <span className="text-orange">*</span></label>
                    <input className={inputCls} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                    <FieldError error={field.state.meta.errors[0]} />
                  </div>
                )}
              </form.Field>
              <form.Field name="last_name" validators={{ onChange: ({ value }) => value.trim() ? undefined : 'Required' }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>Last name <span className="text-orange">*</span></label>
                    <input className={inputCls} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                    <FieldError error={field.state.meta.errors[0]} />
                  </div>
                )}
              </form.Field>
              <form.Field name="date_of_birth" validators={{ onChange: ({ value }) => value ? undefined : 'Required' }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>Date of birth <span className="text-orange">*</span></label>
                    <DateInput value={field.state.value} onChange={(v) => field.handleChange(v)} className="w-full" />
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
            </div>
          </FormCard>

          {/* ── 02 Contact & address ───────────────────────────────── */}
          <FormCard id="contact" num="02" kicker="Reach" title="Contact & address"
            helper="Where the client is visited and how to reach them."
            cardRef={(el) => { sectionEls.current.contact = el }}>
            <div className="grid grid-cols-2 gap-[18px] mb-[18px]">
              <form.Field name="phone_number" validators={{ onBlur: ({ value }) => validatePhone(value) }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input className={`${inputCls} font-mono`} value={field.state.value}
                      onChange={(e) => field.handleChange(formatPhone(e.target.value))} onBlur={field.handleBlur} placeholder="709 555 1234" />
                    <FieldError error={field.state.meta.errors[0]} />
                  </div>
                )}
              </form.Field>
              <form.Field name="email" validators={{ onChange: ({ value }) => !value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? undefined : 'Invalid email' }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" className={`${inputCls} font-mono`} value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                    <FieldError error={field.state.meta.errors[0]} />
                  </div>
                )}
              </form.Field>
            </div>
            <form.Field name="street" validators={{ onChange: ({ value }) => value.trim() ? undefined : 'Required' }}>
              {(field) => (
                <div className="mb-[18px]">
                  <label className={labelCls}>Street <span className="text-orange">*</span></label>
                  <input className={inputCls} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="21 Quidi Vidi Rd" />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>
            <div className="grid grid-cols-[1fr_110px_130px] gap-[18px]">
              <form.Field name="city" validators={{ onChange: ({ value }) => value.trim() ? undefined : 'Required' }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>City <span className="text-orange">*</span></label>
                    <input className={inputCls} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="St John's" />
                    <FieldError error={field.state.meta.errors[0]} />
                  </div>
                )}
              </form.Field>
              <form.Field name="province" validators={{ onChange: ({ value }) => value ? undefined : 'Required' }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>Province <span className="text-orange">*</span></label>
                    <select className={selectCls} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur}>
                      <option value="">—</option>
                      {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <FieldError error={field.state.meta.errors[0]} />
                  </div>
                )}
              </form.Field>
              <form.Field name="postal_code" validators={{ onChange: ({ value }) => value.trim() ? undefined : 'Required' }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>Postal code <span className="text-orange">*</span></label>
                    <input className={`${inputCls} font-mono`} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="A1A 1A1" />
                    <FieldError error={field.state.meta.errors[0]} />
                  </div>
                )}
              </form.Field>
            </div>
          </FormCard>

          {/* ── 03 Emergency contact ───────────────────────────────── */}
          <FormCard id="emergency" num="03" kicker="In case of emergency" title="Emergency contact"
            helper="Who to reach if something happens during a visit."
            cardRef={(el) => { sectionEls.current.emergency = el }}>
            <form.Field name="emergency_contact_name" validators={{ onChange: ({ value }) => value.trim() ? undefined : 'Required' }}>
              {(field) => (
                <div className="mb-[18px]">
                  <label className={labelCls}>Full name <span className="text-orange">*</span></label>
                  <input className={inputCls} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="Maeve Sheehan" />
                  <FieldError error={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>
            <div className="grid grid-cols-2 gap-[18px]">
              <form.Field name="emergency_contact_relationship" validators={{ onChange: ({ value }) => value.trim() ? undefined : 'Required' }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>Relationship <span className="text-orange">*</span></label>
                    <input className={inputCls} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="Daughter" />
                    <FieldError error={field.state.meta.errors[0]} />
                  </div>
                )}
              </form.Field>
              <form.Field name="emergency_contact_phone" validators={{ onBlur: ({ value }) => validatePhone(value, true) }}>
                {(field) => (
                  <div>
                    <label className={labelCls}>Phone <span className="text-orange">*</span></label>
                    <input className={`${inputCls} font-mono`} value={field.state.value}
                      onChange={(e) => field.handleChange(formatPhone(e.target.value))} onBlur={field.handleBlur} placeholder="709 555 8820" />
                    <FieldError error={field.state.meta.errors[0]} />
                  </div>
                )}
              </form.Field>
            </div>
          </FormCard>

          {/* ── 04 Care profile ────────────────────────────────────── */}
          <FormCard id="care" num="04" kicker="What care looks like" title="Care profile"
            helper="The services this client receives and when care began. Hours come from the authorization, not from here."
            cardRef={(el) => { sectionEls.current.care = el }}>

            {/* Derived from authorizations — read only */}
            <div className="border border-dashed border-line-soft bg-cream-2 px-4 py-3.5 mb-[22px]">
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-2.5">From the active authorization</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {client.service_types.length > 0 ? client.service_types.map((t) => (
                    <span key={t} className="inline-flex items-center px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] border border-ink bg-mint text-ink">
                      {SERVICE_TYPE_LABELS[t]}
                    </span>
                  )) : (
                    <span className="font-mono text-[10px] text-muted">No services authorized yet</span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-ink-soft">
                  Care start: {client.care_start ? format(new Date(client.care_start), 'yyyy-MM-dd') : '—'}
                </span>
              </div>
              <Link to="/dashboard/clients/$clientId/authorization" params={{ clientId: client.id } as never}
                className="inline-flex mt-2.5 font-mono text-[10px] tracking-[0.05em] uppercase text-ink-soft hover:text-ink">
                Manage in Authorization tab →
              </Link>
            </div>

            {/* Editable clinical detail */}
            {([
              ['medical_conditions', 'Medical conditions'],
              ['allergies', 'Allergies'],
              ['medications', 'Medications'],
              ['special_instructions', 'Special instructions'],
              ['notes', 'Notes'],
            ] as const).map(([name, label]) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <div className="mb-[18px] last:mb-0">
                    <label className={labelCls}>{label}</label>
                    <textarea className={`${inputCls} resize-none`} rows={2} value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)} placeholder="Optional" />
                  </div>
                )}
              </form.Field>
            ))}
          </FormCard>

          {/* ── 05 Danger zone ─────────────────────────────────────── */}
          <div id="danger" ref={(el) => { sectionEls.current.danger = el }} className="scroll-mt-14">
            <ClientDangerZone clientId={client.id} />
          </div>

          {serverError && (
            <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
          )}
        </form>
      </div>
    </div>
  )
}
