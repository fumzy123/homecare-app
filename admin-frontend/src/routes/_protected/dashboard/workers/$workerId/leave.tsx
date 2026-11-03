import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_protected/dashboard/workers/$workerId/leave',
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/dashboard/workers/$workerId/attendance',
      params,
      search: { section: 'leave' },
      replace: true,
    })
  },
})
