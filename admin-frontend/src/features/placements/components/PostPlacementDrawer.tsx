import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Kicker } from '@/shared/components/ui'
import { useCreatePlacement } from '../hooks/usePlacements'
import type { PlacementCreatePayload } from '../api'

function validate<T>(shape: z.ZodType<T>, value: T) {
  const r = shape.safeParse(value)
  return r.success ? undefined : r.error.issues[0].message
}

interface Client {
  id: string
  first_name: string
  last_name: string
}

interface PostPlacementDrawerProps {
  clients: Client[]
  preselectedClientId?: string
  onClose: () => void
  onSuccess?: () => void
}

const labelClass  = 'block font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mb-1'
const inputClass  = 'w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink resize-none'
const selectClass = 'w-full bg-cream border border-ink px-3 py-2 font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink appearance-none'

function FieldError({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="mt-1 font-mono text-[10px] text-orange">{error as string}</p>
}

export function PostPlacementDrawer({
  clients,
  preselectedClientId,
  onClose,
  onSuccess,
}: PostPlacementDrawerProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const { mutateAsync: createPlacement, isPending } = useCreatePlacement()

  const form = useForm({
    defaultValues: {
      client_id:         preselectedClientId ?? '',
      shift_description: '',
      requirements:      '',
      masked_location:   '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const payload: PlacementCreatePayload = {
        client_id:         value.client_id,
        shift_description: value.shift_description,
        masked_location:   value.masked_location,
        ...(value.requirements ? { requirements: value.requirements } : {}),
      }
      try {
        await createPlacement(payload)
        onSuccess?.()
        onClose()
      } catch {
        setServerError('Failed to post placement. Please try again.')
      }
    },
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-paper border-l border-ink">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <Kicker>Post Placement</Kicker>
          <button onClick={onClose} className="font-mono text-[18px] text-ink-soft hover:text-ink leading-none">×</button>
        </div>

        <form
          className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5"
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
        >
          {/* Client */}
          <form.Field
            name="client_id"
            validators={{ onChange: ({ value }) => validate(z.string().min(1, 'Required'), value) }}
          >
            {(field) => (
              <div>
                <label htmlFor="client_id" className={labelClass}>Client</label>
                {preselectedClientId ? (
                  <p className="font-mono text-[12px] text-ink font-medium">
                    {clients.find((c) => c.id === preselectedClientId)?.first_name}{' '}
                    {clients.find((c) => c.id === preselectedClientId)?.last_name}
                  </p>
                ) : (
                  <>
                    <select
                      id="client_id"
                      className={selectClass}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    >
                      <option value="">Select client…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.first_name} {c.last_name}
                        </option>
                      ))}
                    </select>
                    <FieldError error={field.state.meta.errors[0]} />
                  </>
                )}
              </div>
            )}
          </form.Field>

          {/* Masked location */}
          <form.Field
            name="masked_location"
            validators={{ onChange: ({ value }) => validate(z.string().min(1, 'Required'), value) }}
          >
            {(field) => (
              <div>
                <label htmlFor="masked_location" className={labelClass}>Area / Masked Location</label>
                <p className="font-mono text-[9px] text-ink-soft mb-1.5">
                  Shown to workers — do not include street number
                </p>
                <input
                  id="masked_location"
                  type="text"
                  placeholder="e.g. East Vancouver, BC"
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          {/* Shift description */}
          <form.Field
            name="shift_description"
            validators={{ onChange: ({ value }) => validate(z.string().min(1, 'Required'), value) }}
          >
            {(field) => (
              <div>
                <label htmlFor="shift_description" className={labelClass}>Shift Description</label>
                <textarea
                  id="shift_description"
                  rows={3}
                  placeholder="e.g. Mon/Wed/Fri mornings, 3 hrs each"
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError error={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>

          {/* Requirements */}
          <form.Field name="requirements">
            {(field) => (
              <div>
                <label htmlFor="requirements" className={labelClass}>Requirements <span className="opacity-40">(optional)</span></label>
                <textarea
                  id="requirements"
                  rows={3}
                  placeholder="e.g. Must have First Aid, driver's licence preferred"
                  className={inputClass}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          </form.Field>

          {serverError && (
            <p className="font-mono text-[10px] text-orange border border-orange px-3 py-2">
              {serverError}
            </p>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2 border-t border-ink mt-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-ink text-cream px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] hover:bg-orange hover:border-orange transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? 'Posting…' : 'Post Placement'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] border border-ink text-ink-soft hover:text-ink hover:bg-cream-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
