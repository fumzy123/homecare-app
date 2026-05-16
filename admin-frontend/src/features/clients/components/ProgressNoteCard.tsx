import { format, parseISO } from 'date-fns'
import type { ClientNoteItem } from '@/features/clients/api'

export function ProgressNoteCard({ note }: { note: ClientNoteItem }) {
  const sorted = [...note.entries].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="px-6 py-5">
      <div className="flex items-baseline justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <p className="font-serif text-[18px] leading-none tracking-[-0.01em]">
            {format(parseISO(note.occurrence_date), 'EEEE, MMM d, yyyy')}
          </p>
          <span className="font-mono text-[10px] text-ink-soft">
            {note.worker_first_name} {note.worker_last_name}
          </span>
        </div>
        <span className="font-mono text-[9px] text-ink-soft tracking-wide">
          {sorted.length} {sorted.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <div className="space-y-2 pl-4 border-l-2 border-line-soft">
        {sorted.map((entry, i) => (
          <div key={i} className="flex items-start gap-4">
            <span className="font-mono text-[10px] text-ink-soft shrink-0 w-12 pt-px">
              {format(new Date(`1970-01-01T${entry.time}`), 'HH:mm')}
            </span>
            <p className="font-mono text-[11px] text-ink leading-snug">{entry.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
