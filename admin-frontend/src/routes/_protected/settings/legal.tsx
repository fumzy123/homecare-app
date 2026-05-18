import { createFileRoute } from '@tanstack/react-router'
import { LegalSection }      from '@/features/settings/components/LegalSection'
import { SettingsPaneHeader } from '@/features/settings/components/SettingsPaneHeader'

export const Route = createFileRoute('/_protected/settings/legal')({
  component: LegalPage,
})

function LegalPage() {
  return (
    <>
      <SettingsPaneHeader
        title="Legal & data privacy"
        sub="Terms acceptance history and policy documents."
      />
      <LegalSection />
    </>
  )
}
