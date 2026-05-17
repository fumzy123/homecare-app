import { useState } from 'react'
import { DateInput } from '@/shared/components/ui'
import {
  LEAVE_TYPE_LABELS,
  type LeaveType,
  type LeaveRecordCreatePayload,
} from '@/features/leave/api'

const LEAVE_TYPES: LeaveType[] = ['sick', 'vacation', 'bereavement', 'other']

interface RecordLeaveModalProps {
  onClose: () => void
  onSubmit: (payload: LeaveRecordCreatePayload) => void
  isPending: boolean
  error: string | null
}

export function RecordLeaveModal({ onClose, onSubmit, isPending, error }: RecordLeaveModalProps) {
  const [leaveType, setLeaveType] = useState<LeaveType>('sick')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [notes, setNotes]         = useState('')

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
              <DateInput value={startDate} onChange={setStartDate} className="w-full" />
            </div>
            <div>
              <label className="block font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft mb-1.5">
                End Date
              </label>
              <DateInput value={endDate} onChange={setEndDate} min={startDate} className="w-full" />
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

          {error && <p className="font-mono text-[10px] text-orange">{error}</p>}

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
