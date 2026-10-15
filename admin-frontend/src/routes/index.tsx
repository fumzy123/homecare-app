import { createFileRoute } from '@tanstack/react-router'
import { LandingPage } from '@/features/landing/LandingPage'
import { EmailLinkError } from '@/features/auth/components/EmailLinkError'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  return hash.has('error') || query.has('error') ? <EmailLinkError /> : <LandingPage />
}
