import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { clientsApi, type ClientNoteItem } from '@/features/clients/api'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/notes')({
  component: ClientNotes,
})

function ClientNotes() {
  const { clientId } = Route.useParams()
  const currentYear  = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const yearOptions  = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['client-notes', clientId, year],
    queryFn:  () => clientsApi.getNotes(clientId, year),
  })

  return (
    <div className="p-10 space-y-8">

      {/* ── Year selector ── */}
      <div className="flex items-center gap-2">
        {yearOptions.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`px-3.5 py-1.5 font-mono text-[10px] tracking-[0.05em] uppercase transition-colors border ${
              year === y
                ? 'bg-ink text-cream border-ink'
                : 'border-ink text-ink-soft hover:text-ink hover:bg-cream-2'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* ── Note feed ── */}
      <div className="border border-ink bg-paper">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <h2 className="font-serif text-[26px] leading-none tracking-[-0.02em]">
            Progress notes <span className="italic text-muted">{year}</span>
          </h2>
          <span className="font-mono text-[11px] text-ink-soft">
            <span className="text-ink font-bold">{notes.length}</span>{' '}
            {notes.length === 1 ? 'visit' : 'visits'} with notes
          </span>
        </div>

        {isLoading ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">LOADING…</p>
        ) : notes.length === 0 ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">
            NO PROGRESS NOTES FOR {year}
          </p>
        ) : (
          <div className="divide-y divide-dashed divide-line-soft">
            {notes.map((note) => (
              <NoteCard key={`${note.shift_id}-${note.occurrence_date}`} note={note} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NoteCard({ note }: { note: ClientNoteItem }) {
  const sorted = [...note.entries].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="px-6 py-5">
      {/* Visit header */}
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

      {/* Entries */}
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
