import { useState } from 'react'
import { format } from 'date-fns'
import { Tag, Kicker } from '@/shared/components/ui'
import type { Authorization } from '../api'
import { SERVICE_TYPE_LABELS, STATUS_TAG } from '../constants'
import { withLineageVersions, fmtHours } from '../utils'

/**
 * Past authorizations as a version lineage — newest first, collapsed by default.
 * The active authorization is never here (it's the hero above). Amendments that
 * share an authorization number read as a story (v2 superseded ← v1 cancelled).
 */
export function AuthHistory({ authorizations }: { authorizations: Authorization[] }) {
  const [open, setOpen] = useState(false)
  const history = withLineageVersions(authorizations.filter((a) => a.status !== 'active'))

  if (history.length === 0) return null

  return (
    <div className="border border-ink bg-paper">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-line-soft text-left">
        <Kicker leader>Authorization history</Kicker>
        <span className="font-mono text-[10px] tracking-[0.06em] uppercase text-ink-soft">
          {history.length} past · newest first {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="px-6 pt-2 pb-5">
          {history.map((a, i) => {
            const tag = STATUS_TAG[a.status]
            const last = i === history.length - 1
            return (
              <div key={a.id} className="flex gap-4 pt-4">
                {/* lineage spine */}
                <div className="flex flex-col items-center pt-1">
                  <span className="dot dot-muted" style={{ width: 9, height: 9 }} />
                  {!last && <span className="w-px flex-1 bg-line-soft mt-1" style={{ minHeight: 34 }} />}
                </div>
                <div className={`flex-1 ${last ? '' : 'pb-1'}`}>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-[11.5px] tracking-[0.03em]">{a.authorization_number}</span>
                    <span className="font-mono text-[9px] text-muted">v{a.version}</span>
                    <Tag variant={tag.variant}>{tag.label}</Tag>
                    <span className="font-mono text-[10px] text-ink-soft ml-auto">
                      {format(new Date(a.covering_start), 'MMM d, yyyy')} → {a.covering_end ? format(new Date(a.covering_end), 'MMM d, yyyy') : 'open-ended'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3.5 mt-2 flex-wrap">
                    <span className="font-mono text-[10.5px] text-ink-soft">
                      {a.funder}{a.funder_file_number ? ` · File #${a.funder_file_number}` : ''}
                    </span>
                    <span className="flex gap-1.5 flex-wrap">
                      {a.services.map((s) => (
                        <span key={s.id} className="inline-flex items-center px-2 py-0.5 font-mono text-[9px] border border-line-soft bg-cream text-ink-soft">
                          {SERVICE_TYPE_LABELS[s.service_type]} · {fmtHours(s.authorized_hours)}h
                        </span>
                      ))}
                    </span>
                  </div>
                  {a.notes && <p className="text-[11.5px] text-ink-soft italic mt-2">{a.notes}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
