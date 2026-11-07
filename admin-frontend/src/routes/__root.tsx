import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { Toaster } from '@/shared/components/Toaster'
import { ConfirmationProvider } from '@/shared/components/ConfirmationProvider'

export const Route = createRootRoute({
  component: () => (
    <ConfirmationProvider>
      <Outlet />
      <Toaster />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </ConfirmationProvider>
  ),
})
