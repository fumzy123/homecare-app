import { useRef, useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { orgMembersApi } from '@/features/org-members/api'
import { useWorkerCredentials, useVerifyCredential, useUploadCredential } from '../hooks/useWorkerCredentials'
import { DateInput } from '@/shared/components/ui'
import type { WorkerCredential } from '@/features/org-members/api'

// ── Types & constants ──────────────────────────────────────────────────────────

type DocStatus = 'expired' | 'expiring' | 'needs_review' | 'missing' | 'valid'

import { DOCUMENT_LABELS } from '../constants'

const ALL_DOCUMENT_TYPES = Object.keys(DOCUMENT_LABELS)

const STATUS_ORDER: Record<DocStatus, number> = {
  expired: 0, needs_review: 1, expiring: 2, missing: 3, valid: 4,
}

const STATUS_CONFIG: Record<DocStatus, { label: string; row: string; chip: string; dot: string }> = {
  expired:      { label: 'Expired',      row: 'bg-[rgba(255,90,31,0.04)]', chip: 'bg-orange text-white border-orange',               dot: 'bg-white' },
  needs_review: { label: 'Needs review', row: '',                           chip: 'bg-transparent text-orange border-orange',         dot: 'bg-orange' },
  expiring:     { label: 'Expiring',     row: '',                           chip: 'bg-yellow text-ink border-[#C9A234]',              dot: 'bg-[#C9A234]' },
  missing:      { label: 'Missing',      row: '',                           chip: 'bg-transparent text-muted border-line-soft',       dot: 'bg-muted' },
  valid:        { label: 'Valid',        row: '',                           chip: 'bg-mint text-ink border-mint-dark',                dot: 'bg-mint-dark' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDocStatus(cred: WorkerCredential | null): DocStatus {
  if (!cred?.file_url) return 'missing'
  if (!cred.verified_at) return 'needs_review'
  if (!cred.expiry_date) return 'valid'
  const today = new Date()
  const expiry = new Date(cred.expiry_date)
  if (expiry < today) return 'expired'
  if (differenceInDays(expiry, today) <= 30) return 'expiring'
  return 'valid'
}

function relativeExpiry(expiryDate: string): { text: string; colorClass: string } {
  const days = differenceInDays(new Date(expiryDate), new Date())
  if (days < 0)   return { text: `Expired ${Math.abs(days)} days ago`, colorClass: 'text-orange' }
  if (days <= 30) return { text: `Expires in ${days} days`,            colorClass: 'text-[#9a7d1e]' }
  return            { text: `Expires in ${days} days`,                 colorClass: 'text-ink-soft' }
}

async function openPreview(workerId: string, documentType: string): Promise<void> {
  const tab = window.open('', '_blank')
  const url = await orgMembersApi.getCredentialPreviewUrl(workerId, documentType)
  if (tab) tab.location.href = url
  else window.location.href = url
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M4 1.5h5l3 3v10H4z" /><path d="M9 1.5v3h3" />
    </svg>
  )
}
function UploadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="shrink-0 text-ink-soft">
      <path d="M8 10.5V2.5M8 2.5L5.2 5.3M8 2.5l2.8 2.8" /><path d="M2.5 10v3h11v-3" />
    </svg>
  )
}
function EyeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z" /><circle cx="8" cy="8" r="1.9" />
    </svg>
  )
}

// ── State chip ─────────────────────────────────────────────────────────────────

function StateChip({ status }: { status: DocStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-[3px] border ${cfg.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Manage panel ───────────────────────────────────────────────────────────────

function ManagePanel({
  workerId,
  credential,
  documentType,
  status,
  onClose,
}: {
  workerId: string
  credential: WorkerCredential | null
  documentType: string
  status: DocStatus
  onClose: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [expiryInput, setExpiryInput]     = useState(credential?.expiry_date ?? '')
  const [previewState, setPreviewState]   = useState<'idle' | 'loading' | string>('idle')
  const { mutate: verify, isPending: isVerifying } = useVerifyCredential(workerId)
  const { mutate: upload, isPending: isUploading } = useUploadCredential(workerId)

  const hasFile    = !!credential?.file_url
  const isUnverified = status === 'needs_review'
  const isLoading  = previewState === 'loading'
  const previewErr = previewState !== 'idle' && previewState !== 'loading' ? previewState : null

  function handleSave() {
    if (!expiryInput || !credential) return
    verify(
      { documentType: credential.document_type, expiryDate: expiryInput },
      { onSuccess: onClose },
    )
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    upload({ documentType, file })
    e.target.value = ''
  }

  async function handlePreview() {
    setPreviewState('loading')
    try {
      await openPreview(workerId, documentType)
      setPreviewState('idle')
    } catch (err) {
      setPreviewState(err instanceof Error ? err.message : 'Could not open document.')
    }
  }

  return (
    <div className="bg-cream-2 border-t border-dashed border-line-soft px-4 py-5 flex gap-7 items-start">

      {/* Zone A — document file */}
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2.5">Document file</p>

        {hasFile ? (
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="inline-flex items-center gap-2 border border-ink bg-paper px-2.5 py-1.5 font-mono text-[11px]">
              <DocIcon />{documentType}.pdf
            </span>
            <button
              type="button"
              onClick={handlePreview}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.08em] uppercase border border-ink px-2.5 py-1.5 text-ink hover:bg-cream-3 transition-colors disabled:opacity-50"
            >
              <EyeIcon />{isLoading ? 'Opening…' : 'View'}
            </button>
          </div>
        ) : (
          <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-muted mb-3">No file uploaded yet</p>
        )}

        {previewErr && <p className="font-mono text-[10px] text-orange mb-3">{previewErr}</p>}

        {/* Dropzone */}
        <div
          className="border border-dashed border-[rgba(17,17,17,0.34)] bg-paper px-3.5 py-3 flex items-center gap-3 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-medium">{hasFile ? 'Replace document' : 'Upload document'}</p>
            <p className="font-mono text-[9.5px] tracking-[0.04em] text-muted mt-0.5">Drop a PDF or image, or browse — max 10 MB</p>
          </div>
          <button
            type="button"
            disabled={isUploading}
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
            className="font-mono text-[9px] tracking-[0.08em] uppercase border border-ink bg-paper px-3 py-1.5 text-ink hover:bg-cream-2 transition-colors disabled:opacity-50 shrink-0"
          >
            {isUploading ? 'Uploading…' : 'Browse'}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* Zone B — expiry date */}
      <div className="w-[236px] shrink-0">
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-2.5">Expiry date</p>
        <DateInput value={expiryInput} onChange={setExpiryInput} className="w-full mb-2.5" />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!expiryInput || isVerifying || !credential}
            className="flex-1 bg-ink text-cream font-mono text-[10px] tracking-[0.08em] uppercase px-3 py-2 hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {isVerifying ? 'Saving…' : isUnverified ? '✓ Verify' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[10px] tracking-[0.08em] uppercase px-3 py-2 border border-ink text-ink-soft hover:text-ink transition-colors"
          >
            Close
          </button>
        </div>
        {isUnverified && (
          <p className="font-mono text-[9px] tracking-[0.03em] text-muted mt-2.5 leading-relaxed">
            Saving an expiry date marks this document verified.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Credential row ─────────────────────────────────────────────────────────────

function CredentialRow({
  workerId,
  credential,
  documentType,
  isFirst,
  isOpen,
  onToggle,
}: {
  workerId: string
  credential: WorkerCredential | null
  documentType: string
  isFirst: boolean
  isOpen: boolean
  onToggle: () => void
}) {
  const status   = getDocStatus(credential)
  const label    = DOCUMENT_LABELS[documentType] ?? documentType
  const uploaded = credential?.uploaded_at ? format(new Date(credential.uploaded_at), 'MMM d, yyyy') : null
  const expiry   = credential?.expiry_date
  const rel      = expiry ? relativeExpiry(expiry) : null

  return (
    <>
      <div
        className={`grid items-center ${!isFirst ? 'border-t border-dashed border-line-soft' : ''} ${isOpen ? 'bg-cream-2' : STATUS_CONFIG[status].row}`}
        style={{ gridTemplateColumns: '1.8fr 1fr 1.5fr 0.9fr' }}
      >
        {/* Document */}
        <div className="px-4 py-[13px] min-w-0">
          <p className="text-[13.5px] font-medium leading-snug">{label}</p>
          <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-muted">
            {uploaded ? `Uploaded ${uploaded}` : 'Not uploaded'}
          </p>
        </div>

        {/* Status */}
        <div className="px-4 py-[13px]">
          <StateChip status={status} />
        </div>

        {/* Expiry */}
        <div className="px-4 py-[13px]">
          {expiry ? (
            <>
              <p className="text-[12.5px] tabular-nums">{format(new Date(expiry), 'MMM d, yyyy')}</p>
              {rel && <p className={`font-mono text-[9.5px] ${rel.colorClass}`}>{rel.text}</p>}
            </>
          ) : (
            <span className="font-mono text-[11px] text-muted">—</span>
          )}
        </div>

        {/* Manage toggle — one consistent control on every row */}
        <div className="px-4 py-[13px] flex justify-end">
          <button
            type="button"
            onClick={onToggle}
            className={`inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.08em] uppercase border border-ink px-3 py-[7px] transition-colors ${
              isOpen ? 'bg-ink text-cream' : 'bg-transparent text-ink hover:bg-cream-2'
            }`}
          >
            Manage
            <span className="text-[8px] leading-none">{isOpen ? '▲' : '▼'}</span>
          </button>
        </div>
      </div>

      {isOpen && (
        <ManagePanel
          workerId={workerId}
          credential={credential}
          documentType={documentType}
          status={status}
          onClose={onToggle}
        />
      )}
    </>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function WorkerDocumentsTab({ workerId }: { workerId: string }) {
  const { data: credentials = [], isLoading } = useWorkerCredentials(workerId)
  const [managedType, setManagedType] = useState<string | null>(null)

  if (isLoading) return <p className="font-mono text-[11px] text-muted">Loading…</p>

  const byType = Object.fromEntries(credentials.map((c) => [c.document_type, c]))

  const allDocs = ALL_DOCUMENT_TYPES
    .map((type) => ({ type, credential: byType[type] ?? null, status: getDocStatus(byType[type] ?? null) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

  const counts = allDocs.reduce<Partial<Record<DocStatus, number>>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1
    return acc
  }, {})

  const validCount     = counts.valid ?? 0
  const needsAttention = (counts.expired ?? 0) + (counts.needs_review ?? 0)

  const summaryItems: Array<{ status: DocStatus; label: string }> = [
    { status: 'valid',        label: 'Valid' },
    { status: 'expiring',     label: 'Expiring' },
    { status: 'expired',      label: 'Expired' },
    { status: 'needs_review', label: 'Needs review' },
    { status: 'missing',      label: 'Missing' },
  ]

  return (
    <div>
      {/* Summary strip */}
      <div className="flex items-center border border-ink bg-cream mb-[18px]">
        <div className="px-5 py-3.5 border-r border-line-soft shrink-0">
          <p className="font-serif text-[30px] font-medium leading-none">
            {validCount}<span className="text-[16px] text-muted">/{ALL_DOCUMENT_TYPES.length}</span>
          </p>
          <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft mt-[3px]">Compliant</p>
        </div>
        <div className="flex flex-wrap gap-x-[22px] gap-y-2.5 px-5">
          {summaryItems.map(({ status, label }) => {
            const n   = counts[status] ?? 0
            const cfg = STATUS_CONFIG[status]
            return (
              <span key={status} className={`inline-flex items-center gap-[7px] font-mono text-[10px] tracking-[0.06em] uppercase ${n ? 'text-ink' : 'text-muted'}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                {n} {label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Attention banner */}
      {needsAttention > 0 && (
        <div className="flex items-center gap-2.5 border border-orange bg-orange-soft px-3.5 py-2.5 mb-[18px]">
          <span className="w-1.5 h-1.5 rounded-full bg-orange shrink-0" />
          <p className="font-mono text-[10px] tracking-[0.04em] uppercase">
            {needsAttention} item{needsAttention !== 1 ? 's' : ''} need attention —{' '}
            <strong>{counts.expired ?? 0} expired</strong>, {counts.needs_review ?? 0} awaiting review. Sorted to the top.
          </p>
        </div>
      )}

      {/* Credential table */}
      <div className="border border-ink">
        <div className="grid bg-cream-2 border-b border-ink" style={{ gridTemplateColumns: '1.8fr 1fr 1.5fr 0.9fr' }}>
          {['Document', 'Status', 'Expiry', ''].map((h, i) => (
            <div key={i} className={`font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft px-4 py-2.5 ${i === 3 ? 'text-right' : ''}`}>
              {h}
            </div>
          ))}
        </div>
        {allDocs.map((doc, i) => (
          <CredentialRow
            key={doc.type}
            workerId={workerId}
            credential={doc.credential}
            documentType={doc.type}
            isFirst={i === 0}
            isOpen={managedType === doc.type}
            onToggle={() => setManagedType(managedType === doc.type ? null : doc.type)}
          />
        ))}
      </div>
    </div>
  )
}
