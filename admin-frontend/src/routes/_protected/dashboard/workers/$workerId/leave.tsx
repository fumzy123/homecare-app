import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  leaveApi,
  buildStats,
  countDays,
  LEAVE_TYPE_LABELS,
  type LeaveType,
  type LeaveRecordCreatePayload,
} from '@/features/leave/api'

export const Route = createFileRoute('/_protected/dashboard/workers/$workerId/leave')({
  component: WorkerLeave,
})

const LEAVE_TYPES: LeaveType[] = ['sick', 'vacation', 'bereavement', 'other']

const TYPE_COLORS: Record<LeaveType, string> = {
  sick:        'bg-blue-100 text-blue-800 border-blue-200',
  vacation:    'bg-green-100 text-green-800 border-green-200',
  bereavement: 'bg-purple-100 text-purple-800 border-purple-200',
  other:       'bg-amber-100 text-amber-800 border-amber-200',
}

function WorkerLeave() {
  const { workerId } = Route.useParams()
  const queryClient  = useQueryClient()
  const currentYear  = new Date().getFullYear()

  const [year, setYear]         = useState(currentYear)
  const [showModal, setShowModal] = useState(false)

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['leave', workerId, year],
    queryFn:  () => leaveApi.list(workerId, year),
  })

  const stats = buildStats(records)
  const totalDays = Object.values(stats).reduce((a, b) => a + b, 0)

  const createMutation = useMutation({
    mutationFn: (payload: LeaveRecordCreatePayload) => leaveApi.create(workerId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave', workerId, year] })
      setShowModal(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (leaveId: string) => leaveApi.delete(workerId, leaveId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave', workerId, year] }),
  })

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="p-10 space-y-8">

      {/* ── Year selector + action ──────────────────────────────── */}
      <div className="flex items-center justify-between">
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
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 font-mono text-[10px] tracking-[0.08em] uppercase bg-ink text-cream hover:bg-ink/80 transition-colors"
        >
          + Record Leave
        </button>
      </div>

      {/* ── Stat counters ───────────────────────────────────────── */}
      <div className="grid grid-cols-4 border border-ink bg-paper">
        {LEAVE_TYPES.map((type, i) => (
          <div key={type} className={`px-6 py-5 ${i < 3 ? 'border-r border-ink' : ''}`}>
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-3">
              {LEAVE_TYPE_LABELS[type]}
            </p>
            <p className="font-serif text-[48px] leading-none">{stats[type]}</p>
            <p className="font-mono text-[10px] text-ink-soft mt-1">
              {stats[type] === 1 ? 'day' : 'days'}
            </p>
          </div>
        ))}
      </div>

      {/* ── Records list ────────────────────────────────────────── */}
      <div className="border border-ink bg-paper">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink">
          <h2 className="font-serif text-[26px] leading-none tracking-[-0.02em]">
            Leave records <span className="italic text-muted">{year}</span>
          </h2>
          <span className="font-mono text-[11px] text-ink-soft">
            <span className="text-ink font-bold">{totalDays}</span> total days
          </span>
        </div>

        {isLoading ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">LOADING…</p>
        ) : records.length === 0 ? (
          <p className="px-6 py-8 font-mono text-[10px] text-muted text-center tracking-wide">
            NO LEAVE RECORDS FOR {year}
          </p>
        ) : (
          <div className="px-6 py-5">
            <div className="grid grid-cols-5 gap-6 pb-2 border-b border-ink">
              {['Type', 'Start', 'End', 'Days', 'Notes'].map((h) => (
                <p key={h} className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">{h}</p>
              ))}
            </div>
            {records.map((record, i) => (
              <div
                key={record.id}
                className={`grid grid-cols-5 gap-6 py-3 items-center group ${
                  i > 0 ? 'border-t border-dashed border-line-soft' : ''
                }`}
              >
                <span className={`inline-flex px-2 py-0.5 text-[10px] font-mono border w-fit ${TYPE_COLORS[record.leave_type]}`}>
                  {LEAVE_TYPE_LABELS[record.leave_type]}
                </span>
                <p className="font-mono text-[11px]">{format(parseISO(record.start_date), 'MMM d, yyyy')}</p>
                <p className="font-mono text-[11px]">{format(parseISO(record.end_date), 'MMM d, yyyy')}</p>
                <p className="font-mono text-[11px] font-bold">{countDays(record)}</p>
                <div className="flex items-center justify-between">
                  <p className="text-[12px] text-ink-soft truncate">{record.notes ?? '—'}</p>
                  <button
                    onClick={() => deleteMutation.mutate(record.id)}
                    disabled={deleteMutation.isPending}
                    className="opacity-0 group-hover:opacity-100 font-mono text-[9px] tracking-wide uppercase text-orange hover:text-orange/70 transition-opacity ml-2 shrink-0"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Record Leave modal ──────────────────────────────────── */}
      {showModal && (
        <RecordLeaveModal
          onClose={() => setShowModal(false)}
          onSubmit={(payload) => createMutation.mutate(payload)}
          isPending={createMutation.isPending}
          error={createMutation.error?.message ?? null}
        />
      )}
    </div>
  )
}

interface ModalProps {
  onClose: () => void
  onSubmit: (payload: LeaveRecordCreatePayload) => void
  isPending: boolean
  error: string | null
}

function RecordLeaveModal({ onClose, onSubmit, isPending, error }: ModalProps) {
  const [leaveType, setLeaveType] = useState<LeaveType>('sick')
  const [startDate, setStartDate]  = useState('')
  const [endDate, setEndDate]      = useState('')
  const [notes, setNotes]          = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      leave_type: leaveType,
      start_date: startDate,
      end_date:   endDate,
      notes:      notes || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50">
      <div className="bg-cream border border-ink w-full max-w-md p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[28px] leading-none tracking-[-0.02em]">Record Leave</h2>
          <button
            onClick={onClose}
            className="font-mono text-[10px] tracking-wide uppercase text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-1.5">
              Leave Type
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full border border-ink bg-cream px-3 py-2 font-mono text-[12px] focus:outline-none"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-ink bg-cream px-3 py-2 font-mono text-[12px] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-1.5">
                End Date
              </label>
              <input
                type="date"
                required
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-ink bg-cream px-3 py-2 font-mono text-[12px] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-1.5">
              Notes <span className="normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Doctor's note provided"
              className="w-full border border-ink bg-cream px-3 py-2 font-mono text-[12px] focus:outline-none placeholder:text-ink-soft/50"
            />
          </div>

          {error && (
            <p className="font-mono text-[10px] text-orange">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending || !startDate || !endDate}
            className="w-full py-3 bg-ink text-cream font-mono text-[10px] tracking-[0.08em] uppercase disabled:opacity-40 hover:bg-ink/80 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save Record'}
          </button>
        </form>
      </div>
    </div>
  )
}
