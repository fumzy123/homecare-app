import { createFileRoute } from '@tanstack/react-router'
import { InvitationJourney } from '@/features/auth/components/InvitationJourney'

export const Route = createFileRoute('/accept-invite')({ component: InvitationJourney })
