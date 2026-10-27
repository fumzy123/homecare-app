const slot = (id, day_of_week) => ({ id, day_of_week, start_time: '09:00:00', end_time: '14:00:00' })
export const currentRevision = { id: 'revision-2', client_id: 'client-demo', version: 2, imported: false, effective_from: '2026-10-26', scheduled_from: '2026-10-26', activated_at: '2026-10-22T12:00:00Z', created_at: '2026-10-22T12:00:00Z', ends_on: '2026-11-22', supersedes_id: null, care_slots: [slot('mon', 'MO'), slot('wed', 'WE'), slot('fri', 'FR')] }
export const nextRevision = { ...currentRevision, id: 'revision-3', version: 3, effective_from: '2026-11-23', scheduled_from: '2026-11-23', ends_on: null, supersedes_id: currentRevision.id, care_slots: [slot('next-mon', 'MO'), slot('next-fri', 'FR')] }
export const proposal = { ...nextRevision, id: 'revision-4', version: 4, effective_from: '2026-12-01', scheduled_from: null, activated_at: null, care_slots: [slot('proposal-tue', 'TU')] }
export const revisions = [proposal, nextRevision, currentRevision]
const row = (id, worker_name, care_slot_id, day_of_week, extra = {}) => ({ id, worker_id: worker_name, worker_name, client_id: 'client-demo', client_name: 'Evelyn Demo', placement_id: 'request-2', care_slot_id, day_of_week, start_time: '09:00:00', end_time: '14:00:00', starts_on: '2026-10-26', stops_from: null, revision_ends_on: '2026-11-22', end_reason: null, ended_at: null, status: 'active', can_end: false, assignment_source: 'admin_arranged', ...extra })
export const assignmentRows = [
  row('alex', 'Alex Demo', 'mon', 'MO'),
  row('casey', 'Casey Demo', 'wed', 'WE'),
  row('jordan', 'Jordan Demo', 'fri', 'FR', { stops_from: '2026-11-13', status: 'ending', end_reason: 'Morgan taking over Friday coverage.' }),
  row('morgan', 'Morgan Demo', 'fri', 'FR', { starts_on: '2026-11-13', status: 'scheduled' }),
  row('next-alex', 'Alex Demo', 'next-mon', 'MO', { placement_id: 'request-3', starts_on: '2026-11-23', revision_ends_on: null, status: 'scheduled', can_end: true }),
  row('next-alex-friday', 'Alex Demo', 'next-fri', 'FR', { placement_id: 'request-3', starts_on: '2026-11-23', revision_ends_on: null, status: 'scheduled', can_end: true }),
]
