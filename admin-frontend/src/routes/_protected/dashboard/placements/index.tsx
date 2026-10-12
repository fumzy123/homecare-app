import { createFileRoute } from '@tanstack/react-router'
import { CareRequestDirectory } from '@/features/placements/components/CareRequestDirectory'

export const Route = createFileRoute('/_protected/dashboard/placements/')({
  component: CareRequestDirectory,
})
