export const ADMIN_ROLES = ['owner', 'agency_admin'] as const

export function isAdminRole(role: string | undefined | null): boolean {
  return ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number])
}
