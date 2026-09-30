import { createFileRoute } from '@tanstack/react-router'
import { InvitationJourney } from '@/features/auth/components/InvitationJourney'

export const Route = createFileRoute('/welcome')({ component: InvitationJourney })
