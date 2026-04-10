import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/clients/')({
  component: ClientsPage,
})

function ClientsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Clients</h1>
    </div>
  )
}
