import { createFileRoute } from '@tanstack/react-router'
import { ClientDirectory } from '@/features/clients/components/ClientDirectory'
export const Route = createFileRoute('/_protected/dashboard/clients/')({
  component: ClientDirectory,
})
