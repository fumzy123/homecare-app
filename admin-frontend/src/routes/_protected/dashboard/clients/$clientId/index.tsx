import { createFileRoute, redirect } from '@tanstack/react-router'

// The client landing tab is Care Metrics — there is no separate Overview.
export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/dashboard/clients/$clientId/visits', params })
  },
})
