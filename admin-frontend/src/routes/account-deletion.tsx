import { createFileRoute } from '@tanstack/react-router'
import { AccountDeletionPage } from '@/features/privacy/components/AccountDeletionPage'

export const Route = createFileRoute('/account-deletion')({ component: AccountDeletionPage })
