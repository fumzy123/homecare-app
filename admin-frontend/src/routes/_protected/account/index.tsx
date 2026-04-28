import { createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'
import { workersApi } from '@/features/workers/api'
import { useAuthStore } from '@/shared/stores/auth'
import { Kicker } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/account/')({
  component: AccountPage,
})

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name:  z.string().min(1, 'Required'),
  email:      z.string().email('Invalid email'),
})

const labelClass = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass = 'w-full bg-cream border border-ink px-3 py-2.5 font-mono text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-ink'

function AccountPage() {
  const { user, updateUser } = useAuthStore()
  const [saved, setSaved]             = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      first_name: user?.firstName ?? '',
      last_name:  user?.lastName  ?? '',
      email:      user?.email     ?? '',
    },
    onSubmit: async ({ value }) => {
      if (!user) return
      setServerError(null)
      try {
        const updated = await workersApi.updateMember(user.id, {
          first_name: value.first_name,
          last_name:  value.last_name,
          email:      value.email,
        })
        updateUser({ firstName: updated.first_name, lastName: updated.last_name, email: updated.email })
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
  })

  return (
    <div className="min-h-full bg-cream px-10 py-10">
      <div className="max-w-lg">
        <Kicker className="mb-4">Account settings</Kicker>
        <h1 className="font-serif text-[36px] leading-none tracking-[-0.02em] font-medium mb-8">
          Your profile
        </h1>

        <div className="border border-ink bg-paper">
          <div className="px-6 py-4 border-b border-ink">
            <Kicker>Personal info</Kicker>
          </div>

          <form
            className="px-6 py-6 flex flex-col gap-5"
            onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
          >
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="first_name" validators={{ onChange: ({ value }) => {
                const r = schema.shape.first_name.safeParse(value)
                return r.success ? undefined : r.error.issues[0].message
              }}}>
                {(field) => (
                  <div>
                    <label className={labelClass}>First Name</label>
                    <input className={inputClass} value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                    {field.state.meta.errors[0] && (
                      <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0] as string}</p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name="last_name" validators={{ onChange: ({ value }) => {
                const r = schema.shape.last_name.safeParse(value)
                return r.success ? undefined : r.error.issues[0].message
              }}}>
                {(field) => (
                  <div>
                    <label className={labelClass}>Last Name</label>
                    <input className={inputClass} value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                    {field.state.meta.errors[0] && (
                      <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0] as string}</p>
                    )}
                  </div>
                )}
              </form.Field>
            </div>

            <form.Field name="email" validators={{ onChange: ({ value }) => {
              const r = schema.shape.email.safeParse(value)
              return r.success ? undefined : r.error.issues[0].message
            }}}>
              {(field) => (
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" className={inputClass} value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                  {field.state.meta.errors[0] && (
                    <p className="mt-1 font-mono text-[10px] text-orange">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>

            {serverError && (
              <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">{serverError}</p>
            )}

            <div className="flex items-center justify-end gap-4 pt-1">
              {saved && <span className="font-mono text-[10px] text-mint tracking-wide uppercase">Saved ✓</span>}
              <form.Subscribe selector={(s) => s.isSubmitting}>
                {(isSubmitting) => (
                  <button type="submit" disabled={isSubmitting}
                    className="bg-ink text-cream px-5 py-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity">
                    {isSubmitting ? 'Saving…' : 'Save Changes'}
                  </button>
                )}
              </form.Subscribe>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
