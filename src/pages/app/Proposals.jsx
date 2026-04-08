import { useState, useEffect } from 'react'
import { Plus, Search, FileText, Pencil } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { formatDate, formatCurrency } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'

export default function Proposals() {
  const { profile, isOwner, isManager, isSalesperson } = useAuth()
  const navigate = useNavigate()

  const [proposals, setProposals] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')

  useEffect(() => {
    if (!profile?.org_id) return
    supabase
      .from('proposals')
      .select('*, creator:profiles!created_by(full_name)')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('proposals fetch error:', error.message)
        setProposals(data ?? [])
        setLoading(false)
      })
  }, [profile?.org_id])

  const filtered = proposals.filter(p =>
    (p.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.client_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function canEdit(p) {
    const ws = p.workflow_status ?? 'pending'
    if (isOwner) return true
    if (isManager) return ['pending', 'approved'].includes(ws)
    if (isSalesperson) return p.created_by === profile?.id && ws === 'pending'
    return false
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Propuestas</h2>
          <p className="text-sm text-slate-500">{proposals.length} propuestas</p>
        </div>
        <Link to="/app/proposals/new" className="btn-primary text-xs px-3 py-1.5 gap-1.5">
          <Plus className="h-4 w-4" />
          Nueva propuesta
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input className="input-field pl-9" placeholder="Buscar por título o cliente..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-slate-600" />
          <p className="font-medium text-slate-400">{search ? 'Sin resultados' : 'Sin propuestas aún'}</p>
          <p className="mt-1 text-sm text-slate-600">Crea tu primera propuesta comercial</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="card p-4 hover:border-brand/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white truncate">{p.title}</p>
                    <StatusBadge status={p.status} type="proposal" />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{p.client_name}</p>
                  {p.creator?.full_name && (
                    <p className="text-xs text-slate-600">Creado por: {p.creator.full_name}</p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                    <span>{formatDate(p.created_at)}</span>
                    {p.total_value && (
                      <span className="font-medium text-slate-400">{formatCurrency(p.total_value)}</span>
                    )}
                  </div>
                </div>

                {/* Edit button */}
                {canEdit(p) && (
                  <button
                    type="button"
                    onClick={() => navigate(`/app/proposals/${p.id}/edit`)}
                    className="shrink-0 flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-800 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-brand/40 hover:text-brand transition-colors"
                    title="Editar propuesta"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
