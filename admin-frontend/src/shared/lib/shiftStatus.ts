// Single source of truth for shift completion status colours and labels.
// Every component that renders a status — badge, dot, calendar block, timeline
// block — must import from here. Never define status colours inline.

export type ShiftStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'dropped'

export interface StatusToken {
  label:       string
  bg:          string   // hex fill
  color:       string   // hex text
  border:      string   // hex border
  dashed?:     boolean  // dashed border
}

export const STATUS_TOKENS: Record<string, StatusToken> = {
  scheduled:   { label: 'Scheduled',   bg: '#FFE2D4', color: '#111111', border: '#111111', dashed: true },
  in_progress: { label: 'In Progress', bg: '#9DE8DC', color: '#111111', border: '#111111' },
  completed:   { label: 'Completed',   bg: '#EDE8DC', color: '#111111', border: '#111111' },
  no_show:     { label: 'No Show',     bg: '#FF5A1F', color: '#ffffff', border: '#FF5A1F' },
  cancelled:   { label: 'Cancelled',   bg: '#F2EEE5', color: '#8A8378', border: '#8A8378', dashed: true },
  dropped:     { label: 'Dropped',     bg: '#F4D35E', color: '#111111', border: '#111111' },
}

export function getStatusToken(status: string): StatusToken {
  return STATUS_TOKENS[status] ?? STATUS_TOKENS.scheduled
}

// Statuses the admin can manually assign. in_progress is intentionally excluded
// because it is computed from time, not a human decision.
// 'cancelled' is intentionally excluded — cancellation is a dedicated flow
// with a required reason, not a status the admin sets via the edit dropdown.
export const ADMIN_SELECTABLE_STATUSES: ShiftStatus[] = [
  'scheduled',
  'completed',
  'no_show',
  'dropped',
]
