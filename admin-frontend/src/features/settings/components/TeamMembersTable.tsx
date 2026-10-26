import { Fragment, useState } from 'react'
import { EMPLOYMENT_TYPE_LABELS, type OrgMember } from '@/features/org-members/api'
import { ROLE_LABELS } from '@/features/invitations/constants'
import { StatusDot } from '@/shared/components/ui'

// Layer 2: supplied member records only; profile expansion does not fetch data.
export function TeamMembersTable({ members, caption, showRole = true }: {
  members: OrgMember[]
  caption: string
  showRole?: boolean
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line-soft bg-cream-2 font-mono text-[10px] uppercase tracking-wide text-ink-soft">
          <tr>{['Name', 'Email', ...(showRole ? ['Role'] : []), 'Status', 'Profile'].map(label => <th key={label} scope="col" className="px-6 py-3 font-normal">{label}</th>)}</tr>
        </thead>
        <tbody>
          {members.map(member => (
            <Fragment key={member.id}>
              <tr className="border-b border-line-soft last:border-0">
                <th scope="row" className="px-6 py-4 font-medium">{member.first_name} {member.last_name}</th>
                <td className="px-6 py-4 break-all text-ink-soft">{member.email}</td>
                {showRole && <td className="px-6 py-4">{ROLE_LABELS[member.role] ?? member.role}</td>}
                <td className="px-6 py-4"><StatusDot status={member.is_active ? 'active' : 'inactive'} /></td>
                <td className="px-6 py-4">
                  <button type="button" aria-expanded={expanded === member.id} aria-controls={`team-profile-${member.id}`}
                    aria-label={`${expanded === member.id ? 'Hide' : 'View'} profile for ${member.first_name} ${member.last_name}`}
                    className="whitespace-nowrap underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                    onClick={() => setExpanded(expanded === member.id ? null : member.id)}>
                    {expanded === member.id ? 'Hide profile' : 'View profile'}
                  </button>
                </td>
              </tr>
              <tr hidden={expanded !== member.id} id={`team-profile-${member.id}`}>
                <td colSpan={showRole ? 5 : 4} className="border-b border-line-soft bg-cream-2 px-6 py-5">
                  <dl className="grid gap-5 sm:grid-cols-3">
                    {[
                      ['Phone', member.phone_number || 'Not provided'],
                      ['Employment type', member.employment_type ? EMPLOYMENT_TYPE_LABELS[member.employment_type] : 'Not provided'],
                      ['Hire date', member.hire_date ? new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${member.hire_date}T00:00:00Z`)) : 'Not provided'],
                    ].map(([label, value]) => <div key={label}><dt className="mb-1 font-mono text-[10px] uppercase tracking-wide text-ink-soft">{label}</dt><dd>{value}</dd></div>)}
                  </dl>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
