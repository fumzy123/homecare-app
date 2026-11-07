import { useConfirmation } from '@/shared/components/confirmation'
import { MAX_INPUT_DATE } from '@/shared/lib/date'
import { useRef, useState } from 'react'
import { ArrowUpRight, FileCheck2, FileText, Upload } from 'lucide-react'
import {
  orgMembersApi,
  type WorkerCredential,
} from '@/features/org-members/api'
import { useUnsavedChanges } from '@/features/attention/hooks/useUnsavedChanges'
import { errorMessage } from '@/features/clients/lib/care'
import {
  useWorkerCredentials,
  useVerifyCredential,
  useUploadCredential,
} from '../hooks/useWorkerCredentials'
import {
  credentialLabels,
  credentialPriority,
  credentialStatus,
  dateLabel,
} from '../lib/profile'
import { DOCUMENT_LABELS } from '../constants'
import { WorkerDialog, WorkerLoading, WorkerPanel } from './WorkerProfileUI'

function DocumentEditor({
  workerId,
  type,
  credential,
  onClose,
}: {
  workerId: string
  type: string
  credential?: WorkerCredential
  onClose: () => void
}) {
  const confirm = useConfirmation()
  const verify = useVerifyCredential(workerId),
    upload = useUploadCredential(workerId)
  const [expiry, setExpiry] = useState(credential?.expiry_date || ''),
    [error, setError] = useState(''),
    [opening, setOpening] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const busy = verify.isPending || upload.isPending || opening
  const dirty = expiry !== (credential?.expiry_date || '')
  useUnsavedChanges(dirty, undefined, busy)
  const close = async () => {
    if (!busy && (!dirty || await confirm({ title: 'Discard expiry date change?' })))
      onClose()
  }
  async function preview() {
    setOpening(true)
    setError('')
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    try {
      const url = await orgMembersApi.getCredentialPreviewUrl(workerId, type)
      if (tab) tab.location.href = url
      else setError('Allow pop-ups to view this document, then try again.')
    } catch (err) {
      tab?.close()
      setError(errorMessage(err))
    } finally {
      setOpening(false)
    }
  }
  return (
    <WorkerDialog
      title={DOCUMENT_LABELS[type] || type}
      subtitle="Document review"
      onClose={close}
      busy={busy}
    >
      <div className="wp-document-file">
        <FileText size={24} />
        <p className="wp-gap">
          {credential?.file_url ? 'Document on file' : 'No document uploaded'}
        </p>
        {credential?.uploaded_at && (
          <p className="wp-muted wp-gap">
            Uploaded {dateLabel(credential.uploaded_at)}
          </p>
        )}
        {credential?.file_url && (
          <button
            className="wp-btn"
            disabled={busy}
            onClick={() => void preview()}
          >
            {opening ? 'Opening…' : 'View document'}
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>
      <button
        className="wp-btn"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Upload size={15} />
        {upload.isPending
          ? 'Uploading…'
          : credential?.file_url
            ? 'Replace document'
            : 'Upload document'}
      </button>
      <input
        ref={input}
        type="file"
        aria-label="Document file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file || busy) return
          setError('')
          if (file.size > 10 * 1024 * 1024) {
            setError('Choose a PDF or image smaller than 10 MB.')
            return
          }
          try {
            await upload.mutateAsync({ documentType: type, file })
          } catch (err) {
            setError(errorMessage(err))
          }
        }}
      />
      <p className="wp-muted wp-gap">PDF, JPG or PNG · Maximum 10 MB</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!expiry || !credential?.file_url || busy) return
          setError('')
          try {
            await verify.mutateAsync({ documentType: type, expiryDate: expiry })
            onClose()
          } catch (err) {
            setError(errorMessage(err))
          }
        }}
      >
        <label className="wp-field" style={{ marginTop: 24 }}>
          Expiry date
          <input
            className="wp-input"
            type="date" max={MAX_INPUT_DATE}
            required
            disabled={busy || !credential?.file_url}
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        </label>
        <p className="wp-muted wp-gap">
          Check the uploaded document and its expiry date before verifying.
        </p>
        {error && (
          <p className="wp-error" role="alert">
            {error}
          </p>
        )}
        <div className="wp-actions">
          <button
            type="button"
            className="wp-btn"
            disabled={busy}
            onClick={close}
          >
            Close
          </button>
          <button
            type="submit"
            className="wp-btn wp-primary"
            disabled={busy || !expiry || !credential?.file_url}
          >
            {verify.isPending
              ? 'Saving…'
              : credential?.verified_at
                ? 'Save expiry date'
                : 'Verify document'}
          </button>
        </div>
      </form>
    </WorkerDialog>
  )
}

export function WorkerDocumentsTab({
  workerId,
  today,
  initialDocumentType,
}: {
  workerId: string
  today: string
  initialDocumentType?: string
}) {
  const query = useWorkerCredentials(workerId)
  const [managed, setManaged] = useState<string | null>(
    initialDocumentType || null,
  )
  const [previousDocument, setPreviousDocument] = useState(initialDocumentType)
  if (previousDocument !== initialDocumentType) {
    setPreviousDocument(initialDocumentType)
    setManaged(initialDocumentType || null)
  }
  if (query.isPending || !query.data)
    return (
      <WorkerLoading error={query.isError} retry={() => void query.refetch()} />
    )
  const types = [
    ...new Set([
      ...Object.keys(DOCUMENT_LABELS),
      ...query.data.map((c) => c.document_type),
    ]),
  ]
  const documents = types
    .map((type) => {
      const credential = query.data.find((c) => c.document_type === type)
      return { type, credential, status: credentialStatus(credential, today) }
    })
    .sort((a, b) => credentialPriority[a.status] - credentialPriority[b.status])
  const onFile = documents.filter((d) => d.status !== 'missing'),
    missing = documents.filter((d) => d.status === 'missing')
  const renderRow = ({
    type,
    credential,
    status,
  }: (typeof documents)[number]) => (
    <div className="wp-document" key={type}>
      <FileCheck2 size={20} />
      <div>
        <p>{DOCUMENT_LABELS[type] || type}</p>
        <p className="wp-muted">
          {status === 'review'
            ? `Uploaded ${credential?.uploaded_at ? dateLabel(credential.uploaded_at) : '· date not recorded'}`
            : credential?.expiry_date
              ? `Expires ${dateLabel(credential.expiry_date)}`
              : status === 'missing'
                ? 'No uploaded file'
                : 'No expiry recorded'}
        </p>
      </div>
      <span
        className={`wp-badge${['review', 'expired', 'expiring'].includes(status) ? ' wp-badge-attention' : status === 'missing' ? ' wp-badge-neutral' : ''}`}
      >
        {credentialLabels[status]}
      </span>
      <button
        className="wp-icon"
        aria-label={`Manage ${DOCUMENT_LABELS[type] || type}`}
        onClick={() => setManaged(type)}
      >
        <ArrowUpRight size={16} />
      </button>
    </div>
  )
  const selected = query.data.find((c) => c.document_type === managed)
  return (
    <>
      {query.isError && (
        <WorkerLoading error refresh retry={() => void query.refetch()} />
      )}
      <div className="wp-section-heading">
        <h2>Credentials, easy to keep current.</h2>
        <p className="wp-muted">
          Review uploads, check expiry dates, and keep the worker’s documents
          together.
        </p>
      </div>
      <WorkerPanel
        title="On file"
        action={<span className="wp-muted">{onFile.length} documents</span>}
      >
        {onFile.length ? (
          onFile.map(renderRow)
        ) : (
          <p className="wp-muted">
            No documents uploaded yet. Add a document below.
          </p>
        )}
      </WorkerPanel>
      {missing.length > 0 && (
        <details open={onFile.length === 0 || undefined}>
          <summary>Not on file · {missing.length} document types</summary>
          <div className="wp-gap">{missing.map(renderRow)}</div>
        </details>
      )}
      {managed && (
        <DocumentEditor
          key={`${managed}:${selected?.uploaded_at || ''}`}
          workerId={workerId}
          type={managed}
          credential={selected}
          onClose={() => setManaged(null)}
        />
      )}
    </>
  )
}
