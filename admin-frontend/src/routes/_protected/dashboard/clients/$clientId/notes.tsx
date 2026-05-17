import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { clientsApi } from '@/features/clients/api'
import { ProgressNoteCard } from '@/features/clients/components/ProgressNoteCard'
import { YearSelector } from '@/shared/components/ui'

export const Route = createFileRoute('/_protected/dashboard/clients/$clientId/notes')({
  component: ClientNotes,
})

function ClientNotes() {
  const { clientId } = Route.useParams()
  const currentYear  = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['client-notes', clientId, year],
    queryFn:  () => clientsApi.getNotes(clientId, year),
  })

  return (
    <div className="p-10 space-y-8">
      <YearSelector year={year} onChange={setYear} />

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
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">NO PROGRESS NOTES FOR {year}</p>
        ) : (
          <div className="divide-y divide-dashed divide-line-soft">
            {notes.map((note) => (
              <ProgressNoteCard key={`${note.shift_id}-${note.occurrence_date}`} note={note} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
