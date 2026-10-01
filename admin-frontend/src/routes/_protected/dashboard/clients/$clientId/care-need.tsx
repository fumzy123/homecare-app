import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Kicker } from '@/shared/components/ui'
import {
  useClientAuthorizations,
  useAuthorizationCompliance,
  useCancelAuthorization,
} from '@/features/authorizations/hooks/useAuthorizations'
import { ActiveAuthHero } from '@/features/authorizations/components/ActiveAuthHero'
import { AuthHistory } from '@/features/authorizations/components/AuthHistory'
import { AuthorizationDrawer } from '@/features/authorizations/components/AuthorizationDrawer'
import { activeAuthorization } from '@/features/authorizations/utils'
import { WeeklyCareNeedEditor } from '@/features/weekly-care-need/components/WeeklyCareNeedEditor'
import { useClient } from '@/features/clients/hooks/useClients'
import type { Authorization } from '@/features/authorizations/api'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/care-need')({
  component: ClientCareNeed,
})

function ClientCareNeed() {
  const { clientId } = Route.useParams()
  const { data: client } = useClient(clientId)

  // Self-pay clients have no authorization — this tab is just their weekly care need.
  if (client && client.care_arrangement !== 'funded') {
    return (
      <div className="p-8 flex flex-col gap-[22px]">
        <WeeklyCareNeedEditor clientId={clientId} enforceCompliance={false} />
      </div>
    )
  }

  return <FundedCareNeed clientId={clientId} />
}

function FundedCareNeed({ clientId }: { clientId: string }) {
  const { data: authorizations = [], isLoading } = useClientAuthorizations(clientId)
  const { data: compliance } = useAuthorizationCompliance(clientId)
  const { mutate: cancel, isPending: cancelling } = useCancelAuthorization(clientId)

  const [form, setForm] = useState<{ amends?: Authorization } | null>(null)

  const auth = activeAuthorization(authorizations)
  const lapsed = compliance?.coverage === 'lapsed'

  return (
    <div className="p-8 flex flex-col gap-[22px]">
      {/* header */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <Kicker leader className="mb-2">Funding controls what you can plan &amp; bill</Kicker>
          <h2 className="font-serif text-[28px] tracking-[-0.02em] whitespace-nowrap">Authorization &amp; care need</h2>
        </div>
        <button onClick={() => setForm({})}
          className="rounded-full border border-ink bg-ink text-cream px-4 py-2 font-mono text-[12px] tracking-[0.03em] hover:bg-orange hover:border-orange transition-colors">
          ＋ Add authorization
        </button>
      </div>

      {lapsed && (
        <div className="border border-orange bg-orange-soft px-4 py-3">
          <p className="font-mono text-[10px] tracking-[0.08em] uppercase text-orange mb-0.5">⚠ Coverage lapsed</p>
          <p className="text-[13px] text-ink">
            This active client has no current authorization. Renew with the funder to stay compliant.
          </p>
        </div>
      )}

      {isLoading ? (
        <p className="font-mono text-[10px] text-muted tracking-wide">LOADING…</p>
      ) : auth ? (
        <>
          <ActiveAuthHero
            auth={auth}
            onAmend={(a) => setForm({ amends: a })}
            onCancel={cancel}
            cancelling={cancelling}
          />
          <WeeklyCareNeedEditor clientId={clientId} />
          <AuthHistory authorizations={authorizations} />
        </>
      ) : (
        <>
          <div className="border border-dashed border-ink px-8 py-12 text-center">
            <p className="font-serif text-[22px] mb-1.5">No active authorization</p>
            <p className="font-mono text-[10px] text-muted tracking-wide mb-5">
              ADD THE FUNDER'S AUTHORIZATION TO PLAN CARE AND TRACK COMPLIANCE
            </p>
            <button onClick={() => setForm({})}
              className="inline-flex rounded-full border border-ink bg-ink text-cream px-5 py-2.5 font-mono text-[12px] tracking-[0.03em] hover:bg-orange hover:border-orange transition-colors">
              ＋ Add authorization
            </button>
          </div>
          <WeeklyCareNeedEditor clientId={clientId} />
          <AuthHistory authorizations={authorizations} />
        </>
      )}

      {form && (
        <AuthorizationDrawer
          clientId={clientId}
          amends={form.amends}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  )
}
