import { createFileRoute } from '@tanstack/react-router'
import { TeamSection }        from '@/features/settings/components/TeamSection'
import { SettingsPaneHeader } from '@/features/settings/components/SettingsPaneHeader'

export const Route = createFileRoute('/_protected/settings/team')({
  component: TeamPage,
})

function TeamPage() {
  return (
    <>
      <SettingsPaneHeader
        title="Team &amp; invitations"
        sub="Everyone with access and pending invite status."
      />
      <TeamSection />
    </>
  )
}
