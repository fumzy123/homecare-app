import { createFileRoute } from '@tanstack/react-router'
import { ProfileForm }          from '@/features/settings/components/ProfileForm'
import { AccountSecurityCard }  from '@/features/settings/components/AccountSecurityCard'
import { SettingsPaneHeader }   from '@/features/settings/components/SettingsPaneHeader'

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
      <div className="space-y-5">
        <ProfileForm />
        <AccountSecurityCard />
      </div>
    </>
  )
}
