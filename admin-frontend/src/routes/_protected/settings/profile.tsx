import { createFileRoute } from '@tanstack/react-router'
import { ProfileForm }         from '@/features/settings/components/ProfileForm'
import { AccountSecurityCard } from '@/features/settings/components/AccountSecurityCard'
import { SettingsPaneHeader }  from '@/features/settings/components/SettingsPaneHeader'
import { useSelfProfile }      from '@/features/org-members/hooks/useSelfProfile'

export const Route = createFileRoute('/_protected/settings/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const { data: member, isLoading } = useSelfProfile()

  return (
    <>
      <SettingsPaneHeader
        title="My profile"
        sub="Your name and email across the entire console."
      />
      <div className="space-y-5">
        {isLoading || !member ? (
          <p className="font-mono text-[11px] text-muted p-6">Loading…</p>
        ) : (
          <ProfileForm member={member} />
        )}
        <AccountSecurityCard />
      </div>
    </>
  )
}
