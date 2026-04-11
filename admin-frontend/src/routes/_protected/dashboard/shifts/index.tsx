import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_protected/dashboard/shifts/')({
  component: ShiftsPage,
})

function ShiftsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Shifts</h1>
    </div>
  )
}
