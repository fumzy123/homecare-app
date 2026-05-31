import { useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/shared/lib/supabase'
import { useWorkerCredentials, useVerifyCredential } from '../hooks/useWorkerCredentials'
import type { WorkerCredential } from '@/features/org-members/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type PreviewState = 'idle' | 'loading' | { error: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const BUCKET = 'compliance-documents'

const DOCUMENT_LABELS: Record<string, string> = {
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

// ── Document preview ──────────────────────────────────────────────────────────

async function openPreview(storagePath: string): Promise<void> {
  // Open the tab synchronously (before any await) so the browser doesn't treat
  // it as a popup and block it. We set the real URL once the signed URL arrives.
  const tab = window.open('', '_blank')
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 120)
  if (error || !data?.signedUrl) {
    tab?.close()
    throw new Error(error?.message ?? 'Could not generate a preview link. Check storage permissions.')
  }
  if (tab) {
    tab.location.href = data.signedUrl
  } else {
    // Fallback: tab was blocked despite the early open; try direct navigation
    window.location.href = data.signedUrl
  }
}

// ── Credential card ───────────────────────────────────────────────────────────

function CredentialCard({
  workerId,
  credential,
  documentType,
}: {
  workerId: string
  credential: WorkerCredential | null
  documentType: string
}) {
  const [expiryInput, setExpiryInput] = useState('')
  const [preview, setPreview]         = useState<PreviewState>('idle')
  const { mutate: verify, isPending }  = useVerifyCredential(workerId)

  const docType    = credential?.document_type ?? documentType
  const label      = DOCUMENT_LABELS[docType] ?? docType
  const isVerified = credential?.verified_at != null
  const hasFile    = !!credential?.file_url
  const isPreviewing = preview === 'loading'

  async function handlePreview() {
    if (!credential?.file_url) return
    setPreview('loading')
    try {
      await openPreview(credential.file_url)
      setPreview('idle')
    } catch (err) {
      setPreview({ error: err instanceof Error ? err.message : 'Could not open document.' })
    }
  }

  function handleVerify() {
    if (!expiryInput || !credential) return
    verify({ documentType: credential.document_type, expiryDate: expiryInput })
  }

  return (
    <div className={`border border-ink bg-paper p-5 flex flex-col gap-3 ${
      !isVerified && hasFile ? 'border-orange' : ''
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft mb-0.5">
            {docType.replace(/_/g, ' ')}
          </p>
          <p className="text-[15px] font-medium leading-snug">{label}</p>
        </div>
        {isVerified && (
          <span className="shrink-0 rounded-sm bg-ink px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-cream">
            ✓ Verified
          </span>
        )}
        {!isVerified && hasFile && (
          <span className="shrink-0 rounded-sm bg-orange px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white">
            Needs review
          </span>
        )}
      </div>

      {/* File info + preview */}
      {hasFile ? (
        <>
          <div className="flex items-center gap-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-ink-soft mb-0.5">Uploaded</p>
              <p className="text-[12px]">
                {credential!.uploaded_at
                  ? format(new Date(credential!.uploaded_at), 'MMM d, yyyy')
                  : '—'}
              </p>
            </div>
            <button
              onClick={handlePreview}
              disabled={isPreviewing}
              className="ml-auto font-mono text-[9px] uppercase tracking-wider text-ink border border-ink px-3 py-1.5 hover:bg-cream-2 disabled:opacity-50 transition-colors"
            >
              {isPreviewing ? 'Opening…' : 'View document →'}
            </button>
          </div>
          {typeof preview === 'object' && 'error' in preview && (
            <p className="font-mono text-[10px] text-orange">{preview.error}</p>
          )}
        </>
      ) : (
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
          No document uploaded yet
        </p>
      )}

      {/* Expiry info */}
      {credential?.expiry_date && (
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wider text-ink-soft mb-0.5">Expiry date</p>
          <p className="text-[13px]">{format(new Date(credential.expiry_date), 'MMM d, yyyy')}</p>
        </div>
      )}

      {/* Verify form — shown when not yet verified */}
      {!isVerified && (
        <div className="border-t border-line-faint pt-3 flex items-end gap-3">
          <div className="flex-1">
            <label className="font-mono text-[9px] uppercase tracking-wider text-ink-soft block mb-1">
              Expiry date
            </label>
            <input
              type="date"
              value={expiryInput}
              onChange={(e) => setExpiryInput(e.target.value)}
              className="w-full border border-ink bg-cream px-3 py-1.5 font-mono text-[12px] focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
          <button
            onClick={handleVerify}
            disabled={!expiryInput || isPending}
            className="shrink-0 bg-ink text-cream font-mono text-[10px] uppercase tracking-[0.08em] px-4 py-2 hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {isPending ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      )}

      {/* Verified by info */}
      {isVerified && credential?.verified_at && (
        <p className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">
          Verified {format(new Date(credential.verified_at), 'MMM d, yyyy')}
        </p>
      )}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function WorkerDocumentsTab({ workerId }: { workerId: string }) {
  const { data: credentials, isLoading } = useWorkerCredentials(workerId)

  if (isLoading) {
    return <p className="p-8 font-mono text-[11px] text-muted">Loading…</p>
  }

  const byType = Object.fromEntries(
    (credentials ?? []).map((c) => [c.document_type, c])
  )

  const needsReview = ALL_DOCUMENT_TYPES.filter(
    (t) => byType[t]?.file_url && !byType[t]?.verified_at
  )
  const verified   = ALL_DOCUMENT_TYPES.filter((t) => byType[t]?.verified_at)
  const notUploaded = ALL_DOCUMENT_TYPES.filter((t) => !byType[t]?.file_url)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h2 className="font-serif text-[26px] font-medium tracking-[-0.02em] leading-none mb-1">
          Compliance Documents
        </h2>
        <p className="text-[13px] text-ink-soft">
          {needsReview.length > 0
            ? `${needsReview.length} document${needsReview.length > 1 ? 's' : ''} need${needsReview.length === 1 ? 's' : ''} review`
            : 'All uploaded documents verified'}
        </p>
      </div>

      {needsReview.length > 0 && (
        <section className="mb-8">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-orange mb-3">
            Needs review
          </p>
          <div className="flex flex-col gap-3">
            {needsReview.map((t) => (
              <CredentialCard
                key={t}
                workerId={workerId}
                credential={byType[t] ?? null}
                documentType={t}
              />
            ))}
          </div>
        </section>
      )}

      {verified.length > 0 && (
        <section className="mb-8">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-soft mb-3">
            Verified
          </p>
          <div className="flex flex-col gap-3">
            {verified.map((t) => (
              <CredentialCard
                key={t}
                workerId={workerId}
                credential={byType[t] ?? null}
                documentType={t}
              />
            ))}
          </div>
        </section>
      )}

      {notUploaded.length > 0 && (
        <section>
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-soft mb-3">
            Not yet uploaded
          </p>
          <div className="flex flex-col gap-3">
            {notUploaded.map((t) => (
              <CredentialCard
                key={t}
                workerId={workerId}
                credential={null}
                documentType={t}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
