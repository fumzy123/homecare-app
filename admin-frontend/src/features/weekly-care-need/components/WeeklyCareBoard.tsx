import { useRef, useState } from 'react'
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { ClientDialog } from '@/features/clients/components/ClientWorkspaceUI'
import { slotHours } from '@/features/clients/lib/care'
import { WEEKDAYS, WEEKDAY_LABELS } from '../constants'
import { fmtHours } from '../utils'
import type { CareSlotInput } from '../api'
import type { WeekDay } from '../types'
import './weekly-care-board.css'

export type DraftCareSlot = CareSlotInput & { key: string }
type SlotEditor = CareSlotInput & { key?: string; copyDays: WeekDay[] }

// Layer 2: controlled week board. The parent owns the draft and validates changes.
export function WeeklyCareBoard({ slots, onChange, disabled = false }: {
  slots: DraftCareSlot[]
  onChange: (slots: DraftCareSlot[]) => string
  disabled?: boolean
}) {
  const [editor, setEditor] = useState<SlotEditor | null>(null)
  const [error, setError] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropDay, setDropDay] = useState<WeekDay | null>(null)
  const dayButtons = useRef<Partial<Record<WeekDay, HTMLButtonElement | null>>>({})

  function closeEditor(day?: WeekDay) {
    setEditor(null)
    setError('')
    if (day) requestAnimationFrame(() => dayButtons.current[day]?.focus())
  }

  function apply(next: DraftCareSlot[], message: string, day?: WeekDay) {
    if (disabled) return
    const problem = onChange(next)
    setError(problem)
    if (problem) return
    setAnnouncement(message)
    if (editor) closeEditor(day)
  }

  function saveSlot() {
    if (!editor) return
    const slot: DraftCareSlot = {
      key: editor.key || crypto.randomUUID(),
      day_of_week: editor.day_of_week,
      start_time: editor.start_time,
      end_time: editor.end_time,
    }
    const next = editor.key
      ? slots.map(existing => existing.key === editor.key ? slot : existing)
      : [...slots, slot]
    const copies = editor.copyDays.filter(day => day !== slot.day_of_week)
      .map(day => ({ ...slot, key: crypto.randomUUID(), day_of_week: day }))
    apply([...next, ...copies], `Care slot ${editor.key ? 'updated' : 'added'}.`, slot.day_of_week)
  }

  function moveSlot(day: WeekDay) {
    const slot = slots.find(item => item.key === dragging)
    setDragging(null)
    setDropDay(null)
    if (!slot || slot.day_of_week === day) return
    apply(slots.map(item => item.key === slot.key ? { ...item, day_of_week: day } : item),
      `Care slot moved from ${WEEKDAY_LABELS[slot.day_of_week]} to ${WEEKDAY_LABELS[day]}.`)
  }

  return (
    <div className="care-board">
      <p className="cw-muted mb-4" id="care-board-help">
        Add a slot to any day. Click a slot to edit, or drag it to another day.
      </p>
      <div className="cw-week-scroll" role="region" aria-label="Editable weekly care need" tabIndex={0}>
        <div className="cw-week care-board-week" aria-describedby="care-board-help">
          {WEEKDAYS.map(day => {
            const daySlots = slots.filter(slot => slot.day_of_week === day.key)
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
            return (
              <section
                key={day.key}
                aria-label={`${day.label} care slots`}
                className={`cw-day care-board-day ${dropDay === day.key ? 'care-board-drop' : ''}`}
                onDragOver={event => {
                  if (!dragging || disabled) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setDropDay(day.key)
                }}
                onDragLeave={event => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropDay(null)
                }}
                onDrop={event => {
                  if (!dragging || disabled) return
                  event.preventDefault()
                  moveSlot(day.key)
                }}
              >
                <div className="care-board-day-heading">
                  <h4 className="cw-label">{day.label}</h4>
                  <button
                    type="button"
                    ref={node => { dayButtons.current[day.key] = node }}
                    className="cw-icon care-board-add"
                    aria-label={`Add care slot on ${day.label}`}
                    disabled={disabled}
                    onClick={() => {
                      setError('')
                      setEditor({ day_of_week: day.key, start_time: '09:00', end_time: '11:00', copyDays: [] })
                    }}
                  ><Plus size={16} aria-hidden="true" /></button>
                </div>
                {daySlots.map(slot => (
                  <button
                    type="button"
                    key={slot.key}
                    className={`cw-slot cw-slot-open care-board-slot ${dragging === slot.key ? 'care-board-dragging' : ''}`}
                    aria-label={`Edit ${day.label} care slot ${slot.start_time}–${slot.end_time}`}
                    disabled={disabled}
                    draggable={!disabled}
                    onDragStart={event => {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', slot.key)
                      setError('')
                      setDragging(slot.key)
                    }}
                    onDragEnd={() => { setDragging(null); setDropDay(null) }}
                    onClick={() => { setError(''); setEditor({ ...slot, copyDays: [] }) }}
                  >
                    <span className="care-board-slot-heading">
                      <strong>{slot.start_time}–{slot.end_time}</strong>
                      <GripVertical size={14} aria-hidden="true" />
                    </span>
                    <small>Draft care slot</small>
                    <span className="care-board-slot-footer">
                      <span>{fmtHours(slotHours(slot))}h</span>
                      <Pencil size={12} aria-hidden="true" />
                    </span>
                  </button>
                ))}
                {!daySlots.length && <p className="cw-muted mt-5">No care slots</p>}
                {daySlots.length > 0 && <p className="care-board-day-total">{fmtHours(daySlots.reduce((total, slot) => total + slotHours(slot), 0))}h total</p>}
              </section>
            )
          })}
        </div>
      </div>
      <p className="sr-only" role="status">{announcement}</p>
      {error && !editor && <p className="cw-error mt-4" role="alert">{error} The slot has not moved.</p>}
      {editor && (
        <ClientDialog compact title={editor.key ? 'Edit care slot' : 'Add care slot'} onClose={() => closeEditor()}>
          <form onSubmit={event => { event.preventDefault(); saveSlot() }}>
            <label className="cw-field mb-5">
              Day
              <select className="cw-input" aria-label="Day" value={editor.day_of_week}
                onChange={event => { setError(''); setEditor({ ...editor, day_of_week: event.target.value as WeekDay }) }}>
                {WEEKDAYS.map(day => <option key={day.key} value={day.key}>{day.label}</option>)}
              </select>
            </label>
            <div className="cw-form-grid">
              <label className="cw-field">Start time
                <input className="cw-input" type="time" required value={editor.start_time}
                  onChange={event => { setError(''); setEditor({ ...editor, start_time: event.target.value }) }} />
              </label>
              <label className="cw-field">End time
                <input className="cw-input" type="time" required value={editor.end_time}
                  onChange={event => { setError(''); setEditor({ ...editor, end_time: event.target.value }) }} />
              </label>
            </div>
            <fieldset className="mt-5">
              <legend className="cw-muted mb-3">Also add to other days (optional)</legend>
              <div className="care-board-copy-days">
                {WEEKDAYS.filter(day => day.key !== editor.day_of_week).map(day => (
                  <label key={day.key}>
                    <input type="checkbox" checked={editor.copyDays.includes(day.key)}
                      onChange={event => { setError(''); setEditor({ ...editor, copyDays: event.target.checked
                        ? [...editor.copyDays, day.key] : editor.copyDays.filter(value => value !== day.key) }) }} />
                    {day.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {error && <p role="alert" className="cw-error mt-4">{error}</p>}
            <div className="care-board-dialog-actions">
              {editor.key && <button type="button" className="cw-btn" disabled={disabled}
                onClick={() => apply(slots.filter(slot => slot.key !== editor.key), 'Care slot removed.', editor.day_of_week)}>
                <Trash2 size={14} aria-hidden="true" /> Remove slot
              </button>}
              <button type="button" className="cw-btn" onClick={() => closeEditor()}>Cancel</button>
              <button type="submit" className="cw-btn cw-btn-primary" disabled={disabled}>
                {editor.key ? 'Update slot' : 'Add slot'}
              </button>
            </div>
          </form>
        </ClientDialog>
      )}
    </div>
  )
}
