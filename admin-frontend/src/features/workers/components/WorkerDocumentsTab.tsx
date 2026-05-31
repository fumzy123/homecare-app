import { useRef, useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { orgMembersApi } from '@/features/org-members/api'
import { useWorkerCredentials, useVerifyCredential, useUploadCredential } from '../hooks/useWorkerCredentials'
import { DateInput } from '@/shared/components/ui'
import type { WorkerCredential } from '@/features/org-members/api'

// ── Types & constants ──────────────────────────────────────────────────────────

type DocStatus = 'expired' | 'expiring' | 'needs_review' | 'missing' | 'valid'

export const DOCUMENT_LABELS: Record<string, string> = {
  first_aid_cpr:           'First Aid / CPR',
  criminal_record_check:   'Criminal Record Check',
  vulnerable_sector_check: 'Vulnerable Sector Check',
  drivers_license:         "Driver's License",
  child_access_check:      'Child Access Check',
  tb_test:                 'TB Test',
  immunization_record:     'Immunization Record',
  auto_insurance:          'Auto Insurance',
  work_permit:             'Work Permit',
  psw_certificate:         'PSW Certificate',
}

const ALL_DOCUMENT_TYPES = Object.keys(DOCUMENT_LABELS)

const STATUS_ORDER: Record<DocStatus, number> = {
  expired: 0, needs_review: 1, expiring: 2, missing: 3, valid: 4,
}

const STATUS_CONFIG: Record<DocStatus, { label: string; row: string; chip: string; dot: string }> = {
  expired:      { label: 'Expired',      row: 'bg-[rgba(255,90,31,0.04)]', chip: 'bg-orange text-white border-orange',                          dot: 'bg-white' },
  needs_review: { label: 'Needs review', row: '',                           chip: 'bg-transparent text-orange border-orange',                    dot: 'bg-orange' },
  expiring:     { label: 'Expiring',     row: '',                           chip: 'bg-yellow text-ink border-[#C9A234]',                         dot: 'bg-[#C9A234]' },
  missing:      { label: 'Missing',      row: '',                           chip: 'bg-transparent text-muted border-line-soft',                  dot: 'bg-muted' },
  valid:        { label: 'Valid',        row: '',                           chip: 'bg-mint text-ink border-mint-dark',                           dot: 'bg-mint-dark' },
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
  if (days < 0)    return { text: `Expired ${Math.abs(days)} days ago`,  colorClass: 'text-orange' }
  if (days <= 30)  return { text: `Expires in ${days} days`,             colorClass: 'text-[#9a7d1e]' }
  return             { text: `Expires in ${days} days`,                  colorClass: 'text-ink-soft' }
}

async function openPreview(workerId: string, documentType: string): Promise<void> {
  const tab = window.open('', '_blank')
  const url = await orgMembersApi.getCredentialPreviewUrl(workerId, documentType)
  if (tab) tab.location.href = url
  else window.location.href = url
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

// ── Credential row ─────────────────────────────────────────────────────────────

function CredentialRow({
  workerId,
  credential,
  documentType,
  isFirst,
}: {
  workerId: string
  credential: WorkerCredential | null
  documentType: string
  isFirst: boolean
}) {
  const [expiryInput, setExpiryInput]   = useState('')
  const [isEditing, setIsEditing]       = useState(false)
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | string>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { mutate: verify, isPending: isVerifying }   = useVerifyCredential(workerId)
  const { mutate: upload, isPending: isUploading }   = useUploadCredential(workerId)

  const status   = getDocStatus(credential)
  const label    = DOCUMENT_LABELS[documentType] ?? documentType
  const hasFile  = !!credential?.file_url
  const uploaded = credential?.uploaded_at
    ? format(new Date(credential.uploaded_at), 'MMM d, yyyy') : null
  const expiry   = credential?.expiry_date
  const rel      = expiry ? relativeExpiry(expiry) : null

  async function handlePreview() {
    setPreviewState('loading')
    try {
      await openPreview(workerId, documentType)
      setPreviewState('idle')
    } catch (err) {
      setPreviewState(err instanceof Error ? err.message : 'Could not open document.')
    }
  }

  function handleStartEdit() {
    setExpiryInput(expiry ?? '')
    setIsEditing(true)
  }

  function handleSaveEdit() {
    if (!expiryInput || !credential) return
    verify(
      { documentType: credential.document_type, expiryDate: expiryInput },
      { onSuccess: () => setIsEditing(false) },
    )
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    upload({ documentType, file })
    e.target.value = ''
  }

  const isLoading  = previewState === 'loading'
  const previewErr = typeof previewState === 'string' && previewState !== 'idle' && previewState !== 'loading'
    ? previewState : null

  const isVerified = status === 'valid' || status === 'expiring' || status === 'expired'

  return (
    <>
      <div
        className={`grid items-center ${!isFirst ? 'border-t border-dashed border-line-soft' : ''} ${STATUS_CONFIG[status].row}`}
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

        {/* Action */}
        <div className="px-4 py-[13px] flex items-center justify-end gap-2">
          {status === 'missing' ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="font-mono text-[9px] tracking-[0.08em] uppercase border border-ink px-[11px] py-1.5 text-ink hover:bg-cream-2 transition-colors disabled:opacity-50"
            >
              {isUploading ? 'Uploading…' : 'Upload →'}
            </button>
          ) : (
            <>
              {hasFile && status !== 'needs_review' && (
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isLoading}
                  className="font-mono text-[9px] tracking-[0.08em] uppercase border border-ink px-[11px] py-1.5 text-ink hover:bg-cream-2 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Opening…' : 'View →'}
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="font-mono text-[9px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors disabled:opacity-50"
              >
                {isUploading ? 'Uploading…' : 'Upload new'}
              </button>
              {isVerified && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="font-mono text-[9px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors"
                >
                  Edit
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hidden file input shared by all upload buttons in this row */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleUpload}
      />

      {previewErr && (
        <p className="px-4 pb-2 font-mono text-[10px] text-orange border-t border-dashed border-line-soft">
          {previewErr}
        </p>
      )}

      {/* Inline verify strip for needs_review rows */}
      {status === 'needs_review' && (
        <div className="flex items-end gap-3 px-4 pb-4 pt-1 bg-cream-2 border-t border-dashed border-line-soft">
          <div className="w-[200px] shrink-0">
            <label className="font-mono text-[9px] tracking-[0.08em] uppercase text-ink-soft block mb-1">
              Set expiry to verify
            </label>
            <DateInput value={expiryInput} onChange={(v) => setExpiryInput(v)} className="w-full" />
          </div>
          <button
            type="button"
            onClick={() => credential && verify({ documentType: credential.document_type, expiryDate: expiryInput })}
            disabled={!expiryInput || isVerifying || !credential}
            className="shrink-0 bg-ink text-cream font-mono text-[10px] tracking-[0.08em] uppercase px-4 py-2 hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {isVerifying ? 'Saving…' : '✓ Verify'}
          </button>
          {hasFile && (
            <button
              type="button"
              onClick={handlePreview}
              disabled={isLoading}
              className="shrink-0 font-mono text-[10px] tracking-[0.08em] uppercase px-3 py-2 border border-ink text-ink-soft hover:text-ink transition-colors"
            >
              {isLoading ? 'Opening…' : 'View →'}
            </button>
          )}
        </div>
      )}

      {/* Inline edit strip for verified rows */}
      {isEditing && (
        <div className="flex items-end gap-3 px-4 pb-4 pt-1 bg-cream-2 border-t border-dashed border-line-soft">
          <div className="w-[200px] shrink-0">
            <label className="font-mono text-[9px] tracking-[0.08em] uppercase text-ink-soft block mb-1">
              Update expiry date
            </label>
            <DateInput value={expiryInput} onChange={(v) => setExpiryInput(v)} className="w-full" />
          </div>
          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={!expiryInput || isVerifying}
            className="shrink-0 bg-ink text-cream font-mono text-[10px] tracking-[0.08em] uppercase px-4 py-2 hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {isVerifying ? 'Saving…' : '✓ Save'}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="shrink-0 font-mono text-[10px] tracking-[0.08em] uppercase px-3 py-2 border border-ink text-ink-soft hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function WorkerDocumentsTab({ workerId }: { workerId: string }) {
  const { data: credentials = [], isLoading } = useWorkerCredentials(workerId)

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
            <div key={i} className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft px-4 py-2.5">{h}</div>
          ))}
        </div>
        {allDocs.map((doc, i) => (
          <CredentialRow
            key={doc.type}
            workerId={workerId}
            credential={doc.credential}
            documentType={doc.type}
            isFirst={i === 0}
          />
        ))}
      </div>
    </div>
  )
}
