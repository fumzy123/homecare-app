import type { InvitationRole } from './api'

export const ROLE_LABELS: Record<string, string> = {
  owner:               'Owner',
  agency_admin:        'Admin',
  manager:             'Manager',
  supervisor:          'Supervisor',
  financial_officer:   'Financial Officer',
  nurse:               'Nurse',
  home_support_worker: 'Worker',
}

// All roles that can be invited (everything except owner)
export const INVITABLE_ROLES: InvitationRole[] = [
  'agency_admin',
  'manager',
  'supervisor',
  'financial_officer',
  'nurse',
  'home_support_worker',
]

// Staff/admin roles shown in the Team & Invitations settings panel.
// home_support_worker is excluded — workers are invited from the Workers page.
export const STAFF_ROLES: InvitationRole[] = [
  'agency_admin',
  'manager',
  'supervisor',
  'financial_officer',
  'nurse',
]
