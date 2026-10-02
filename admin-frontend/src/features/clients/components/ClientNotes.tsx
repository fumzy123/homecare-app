import { useState } from 'react'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { Search, ChevronDown } from 'lucide-react'
import { Avatar } from '@/shared/components/ui'
import { useClientNotes } from '../hooks/useClients'
import { ClientDialog, ClientEmpty, ClientLoading } from './ClientWorkspaceUI'
import { VisitNotes } from './ClientVisitDialog'
import type { ClientNoteItem } from '../api'

export function ClientNotes({ clientId }: { clientId: string }) {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [worker, setWorker] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ClientNoteItem | null>(null)
  const [dirty, setDirty] = useState(false)
  const date = parseISO(`${month}-01`)
  const query = useClientNotes(
    clientId,
    format(startOfMonth(date), 'yyyy-MM-dd'),
    format(endOfMonth(date), 'yyyy-MM-dd'),
  )
  const workers = [
    ...new Map(
      (query.data || []).map((n) => [
        n.worker_id,
        `${n.worker_first_name} ${n.worker_last_name}`,
      ]),
    ).entries(),
  ]
  const filtered = (query.data || [])
    .filter(
      (n) =>
        (!worker || n.worker_id === worker) &&
        n.entries.some((e) =>
          e.content.toLowerCase().includes(search.toLowerCase()),
        ),
    )
    .sort((a, b) => b.occurrence_date.localeCompare(a.occurrence_date))
  return (
    <div className="cw-stack">
      <h2>Progress notes</h2>
      <div className="cw-notes-filters">
        <div className="cw-search">
          <Search size={16} />
          <input
            className="cw-input"
            aria-label="Search progress notes"
            placeholder="Search progress notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="cw-field">
          Month
          <input
            type="month"
            className="cw-input"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value)
                setWorker('')
              }
            }}
          />
        </label>
        <label className="cw-field">
          Worker
          <select
            className="cw-input"
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
          >
            <option value="">All workers</option>
            {workers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending || query.isError ? (
        <ClientLoading
          error={query.isError}
          retry={() => void query.refetch()}
        />
      ) : !filtered.length ? (
        <ClientEmpty title="No notes in this view">
          Try a different month, worker or search.
        </ClientEmpty>
      ) : (
        <div className="cw-columns">
          <div className="cw-stack">
            {filtered.map((note, i) => (
              <details
                className="cw-panel"
                key={`${note.shift_id}:${note.occurrence_date}`}
                open={i === 0}
              >
                <summary className="cw-panel-heading cursor-pointer">
                  <div className="cw-person">
                    <Avatar
                      initials={`${note.worker_first_name[0]}${note.worker_last_name[0]}`}
                      color="c4"
                    />
                    <div>
                      <h3>
                        {format(parseISO(note.occurrence_date), 'MMM d, yyyy')}
                      </h3>
                      <p className="cw-muted mt-1">
                        {note.worker_first_name} {note.worker_last_name}
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={17} />
                </summary>
                <div className="cw-panel-body">
                  {note.entries.map((entry, index) => (
                    <div className="cw-note-entry" key={index}>
                      <p className="cw-label mb-2">{entry.time}</p>
                      <p>{entry.content}</p>
                    </div>
                  ))}
                  {note.created_at && (
                    <p className="cw-muted mt-4">
                      Recorded{' '}
                      {format(parseISO(note.created_at), 'MMM d, HH:mm')}
                    </p>
                  )}
                  <button
                    className="cw-link mt-5"
                    onClick={() => setSelected(note)}
                  >
                    Add follow-up
                  </button>
                </div>
              </details>
            ))}
          </div>
          <aside className="cw-panel cw-panel-body self-start">
            <h3>In this view</h3>
            <p className="cw-label mt-6">Visits with notes</p>
            <p className="cw-stat mt-2">{filtered.length}</p>
            <p className="cw-muted mt-4">
              Entries stay with their original visit.
            </p>
          </aside>
        </div>
      )}
      {selected && (
        <ClientDialog
          title={`Visit notes · ${format(parseISO(selected.occurrence_date), 'MMM d, yyyy')}`}
          onClose={() => {
            if (dirty && !window.confirm('Discard this unsaved note?')) return
            setDirty(false)
            setSelected(null)
          }}
        >
          <VisitNotes
            shiftId={selected.shift_id}
            date={selected.occurrence_date}
            onDirtyChange={setDirty}
          />
        </ClientDialog>
      )}
    </div>
  )
}
