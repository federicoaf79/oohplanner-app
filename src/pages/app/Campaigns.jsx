import { useState, useEffect, Fragment } from 'react'
import { Search, Megaphone, Calendar } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatCurrency } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'
import { WORKFLOW_STATUSES } from '../../lib/constants'

// ── Helpers ───────────────────────────────────────────────────

const STATUS_IDX = Object.fromEntries(WORKFLOW_STATUSES.map((s, i) => [s.id, i]))

function getDaysRemaining(validUntil) {
  if (!validUntil) return null
  return Math.ceil((new Date(validUntil) - new Date()) / 86_400_000)
}

// ── Workflow stepper ──────────────────────────────────────────

function WorkflowStepper({ status, onChange }) {
  const currentIdx = STATUS_IDX[status] ?? -1

  return (
    <div className="flex items-start">
      {WORKFLOW_STATUSES.map((step, idx) => {
        const isActive = idx === currentIdx
        const isDone   = idx < currentIdx

        return (
          <Fragment key={step.id}>
            {idx > 0 && (
              <div className={`flex-1 h-px mt-[9px] transition-colors ${
                isDone ? 'bg-slate-600' : 'bg-surface-700'
              }`} />
            )}
            <button
              type="button"
              onClick={() => onChange(step.id)}
              className="flex flex-col items-center gap-1 group"
              style={{ minWidth: 0 }}
              title={`Mover a: ${step.label}`}
            >
              <div
                className={`h-[18px] w-[18px] shrink-0 rounded-full border-2 transition-all ${
                  isDone
                    ? 'border-slate-600 bg-slate-700'
                    : isActive
                      ? 'border-transparent'
                      : 'border-surface-700 bg-surface-800'
                }`}
                style={isActive ? {
                  backgroundColor: step.color,
                  boxShadow: `0 0 0 3px ${step.color}30`,
                  borderColor: step.color,
                } : {}}
              />
              <span
                className={`text-[9px] leading-tight text-center transition-colors ${
                  isActive ? 'font-bold' : isDone ? 'text-slate-600' : 'text-slate-700'
                }`}
                style={isActive ? { color: step.color } : {}}
              >
                {step.label}
              </span>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}

// ── Campaign card ─────────────────────────────────────────────

function CampaignCard({ proposal, onStatusChange }) {
  const days      = getDaysRemaining(proposal.valid_until)
  const isExpired = days !== null && days < 0

  return (
    <div className="card p-4 hover:border-brand/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">{proposal.title}</p>
          <p className="mt-0.5 text-sm text-slate-500">{proposal.client_name}</p>
        </div>

        {/* Days badge */}
        {isExpired ? (
          <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400">
            VENCIDA
          </span>
        ) : days !== null && days >= 0 ? (
          <span className="shrink-0 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
            {days}d restantes
          </span>
        ) : null}
      </div>

      {/* Dates + value */}
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
        {proposal.valid_until && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Vence: {formatDate(proposal.valid_until)}
          </span>
        )}
        {proposal.total_value > 0 && (
          <span className="font-medium text-slate-500">{formatCurrency(proposal.total_value)}</span>
        )}
        {proposal.creator?.full_name && (
          <span className="text-slate-700">{proposal.creator.full_name}</span>
        )}
      </div>

      {/* Stepper */}
      <div className="mt-4">
        <WorkflowStepper
          status={proposal.workflow_status}
          onChange={(newStatus) => onStatusChange(proposal.id, newStatus)}
        />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function Campaigns() {
  const { profile } = useAuth()
  const [proposals, setProposals] = useState([])
  const [loading, setLoading]     = useState(false)
  const [search, setSearch]       = useState('')

  useEffect(() => {
    if (!profile?.org_id) return
    setLoading(true)
    supabase
      .from('proposals')
      .select('*, creator:profiles!created_by(full_name)')
      .eq('org_id', profile.org_id)
      .neq('workflow_status', 'pending')
      .not('workflow_status', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('campaigns fetch error:', error.message)
        const rows = data ?? []

        // Auto-withdraw: proposals past valid_until still in installation/active
        const today    = new Date()
        const expiredIds = rows
          .filter(p => ['installation', 'active'].includes(p.workflow_status)
            && p.valid_until && new Date(p.valid_until) < today)
          .map(p => p.id)

        if (expiredIds.length) {
          supabase.from('proposals')
            .update({ workflow_status: 'withdraw' })
            .in('id', expiredIds)
            .then(() => {
              setProposals(rows.map(p =>
                expiredIds.includes(p.id) ? { ...p, workflow_status: 'withdraw' } : p
              ))
            })
        } else {
          setProposals(rows)
        }

        setLoading(false)
      })
  }, [profile?.org_id])

  async function handleStatusChange(proposalId, newStatus) {
    const { error } = await supabase
      .from('proposals')
      .update({ workflow_status: newStatus })
      .eq('id', proposalId)

    if (error) {
      console.error('status update error:', error.message)
      return
    }
    setProposals(prev => prev.map(p =>
      p.id === proposalId ? { ...p, workflow_status: newStatus } : p
    ))
  }

  const filtered = proposals.filter(p =>
    (p.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.client_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Campañas</h2>
          <p className="text-sm text-slate-500">{proposals.length} campañas activas</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          className="input-field pl-9"
          placeholder="Buscar por título o cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16 text-center">
          <Megaphone className="mb-3 h-10 w-10 text-slate-600" />
          <p className="font-medium text-slate-400">
            {search ? 'Sin resultados' : 'Sin campañas activas'}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {search
              ? 'Probá con otro término'
              : 'Las propuestas aprobadas aparecerán aquí'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <CampaignCard key={p.id} proposal={p} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  )
}
