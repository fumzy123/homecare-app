import { useState } from 'react'
import { ClientDialog } from './ClientWorkspaceUI'
import { ClientProfileForm } from './ClientProfileForm'
export function CreateClientDrawer({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [dirty, setDirty] = useState(false)
  const close = () => {
    if (!dirty || window.confirm('Discard your unsaved client?')) onClose()
  }
  return (
    <ClientDialog title="New client" onClose={close}>
      <ClientProfileForm
        onDirtyChange={setDirty}
        onCancel={close}
        onSuccess={() => {
          onSuccess()
          onClose()
        }}
      />
    </ClientDialog>
  )
}
