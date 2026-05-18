import { createFileRoute } from '@tanstack/react-router'
import { ProfileForm }        from '@/features/settings/components/ProfileForm'
import { SettingsPaneHeader } from '@/features/settings/components/SettingsPaneHeader'

export const Route = createFileRoute('/_protected/settings/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  return (
    <>
      <SettingsPaneHeader
        title="My profile"
        sub="Your name and email across the entire console."
      />
      <ProfileForm />
    </>
  )
}
