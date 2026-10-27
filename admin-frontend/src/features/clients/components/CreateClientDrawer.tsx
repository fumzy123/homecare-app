import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { Client } from '../api'
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
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<Client | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const keepEditingRef = useRef<HTMLButtonElement>(null)
  const close = () => {
    if (busy) return
    if (created || !dirty) onClose()
    else setConfirmDiscard(true)
  }
  return (
    <ClientDialog
      title={created ? 'Client created' : 'New client'}
      onClose={close}
    >
      {created ? (
        <div className="cw-stack">
          <p role="status">
            {created.first_name} {created.last_name}’s client record is saved.
          </p>
          <p className="cw-muted">
            Next, set up their weekly care and choose workers.
            Visits are created only when you approve coverage.
          </p>
          <div className="cw-row flex-wrap">
            <Link
              className="cw-btn cw-btn-primary"
              to="/dashboard/clients/$clientId/care-need"
              params={{ clientId: created.id }}
              onClick={onClose}
            >
              Continue setting up care <ArrowRight size={15} />
            </Link>
            <button className="cw-btn" onClick={onClose}>
              Back to clients
            </button>
          </div>
        </div>
      ) : (
        <ClientProfileForm
          onDirtyChange={setDirty}
          onBusyChange={setBusy}
          onCancel={close}
          onSuccess={(saved) => {
            setCreated(saved)
            setBusy(false)
            setDirty(false)
            onSuccess()
          }}
        />
      )}
      {confirmDiscard && (
        <ClientDialog title="Discard changes?" compact initialFocusRef={keepEditingRef} onClose={() => setConfirmDiscard(false)}>
          <div className="cw-stack">
            <p>Your new client hasn’t been saved. Discarding will remove the details you’ve entered.</p>
            <div className="cw-row flex-wrap justify-end">
              <button ref={keepEditingRef} type="button" className="cw-btn cw-btn-primary"
                onClick={() => setConfirmDiscard(false)}>Keep editing</button>
              <button type="button" className="cw-btn" onClick={onClose}>Discard changes</button>
            </div>
          </div>
        </ClientDialog>
      )}
    </ClientDialog>
  )
}
