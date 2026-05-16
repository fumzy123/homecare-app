import { createFileRoute } from '@tanstack/react-router'
import { Kicker } from '@/shared/components/ui'
import { ProfileForm } from '@/features/account/components/ProfileForm'
import { BillingSection } from '@/features/account/components/BillingSection'

export const Route = createFileRoute('/_protected/account/')({
  component: AccountPage,
})

function AccountPage() {
  return (
    <div className="min-h-full bg-cream px-10 py-10">
      <div className="max-w-lg">
        <Kicker className="mb-4">Account settings</Kicker>
        <h1 className="font-serif text-[36px] leading-none tracking-[-0.02em] font-medium mb-8">
          Your profile
        </h1>
        <ProfileForm />
        <BillingSection />
      </div>
    </div>
  )
}
