import { cn } from '../../lib/utils'
import { ROLE_LABELS, CAMPAIGN_STATUS_LABELS, PROPOSAL_STATUS_LABELS } from '../../lib/constants'

const roleClass = {
  owner:       'badge-owner',
  manager:     'badge-manager',
  salesperson: 'badge-salesperson',
}

const statusClass = {
  draft:     'bg-slate-500/10 text-slate-400 ring-slate-500/20',
  active:    'bg-teal-500/10 text-teal-400 ring-teal-500/20',
  paused:    'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  completed: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  cancelled: 'bg-red-500/10 text-red-400 ring-red-500/20',
  sent:      'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  accepted:  'bg-teal-500/10 text-teal-400 ring-teal-500/20',
  rejected:  'bg-red-500/10 text-red-400 ring-red-500/20',
}

export function RoleBadge({ role }) {
  return (
    <span className={roleClass[role] || 'badge-salesperson'}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

export function StatusBadge({ status, type = 'campaign' }) {
  const labels = type === 'proposal' ? PROPOSAL_STATUS_LABELS : CAMPAIGN_STATUS_LABELS
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
      statusClass[status] ?? 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
    )}>
      {labels[status] ?? status}
    </span>
  )
}
