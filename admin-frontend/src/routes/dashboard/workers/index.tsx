import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/workers/')({
  component: WorkersPage,
})

function WorkersPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Workers</h1>
    </div>
  )
}
