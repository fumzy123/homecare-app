import { createFileRoute } from '@tanstack/react-router'
import { AgencySection }      from '@/features/settings/components/AgencySection'
import { SettingsPaneHeader } from '@/features/settings/components/SettingsPaneHeader'

export const Route = createFileRoute('/_protected/settings/agency')({
  component: AgencyPage,
})

function AgencyPage() {
  return (
    <>
      <SettingsPaneHeader
        num="02"
        title="Agency settings"
        sub="Organization record — affects how the agency is identified."
      />
      <AgencySection />
    </>
  )
}
