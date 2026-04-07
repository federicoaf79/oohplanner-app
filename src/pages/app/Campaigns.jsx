import { useState, useEffect } from 'react'
import { Plus, Search, Megaphone, Calendar } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { formatDate, formatCurrency } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'

export default function Campaigns() {
  const { profile } = useAuth()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')

  useEffect(() => {
    if (!profile?.org_id) return
    setLoading(true)
    supabase
      .from('campaigns')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setCampaigns(data ?? []); setLoading(false) })
  }, [profile?.org_id])

  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.client_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Campañas</h2>
          <p className="text-sm text-slate-500">{campaigns.length} campañas en total</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Nueva campaña
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          className="input-field pl-9"
          placeholder="Buscar por nombre o cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16 text-center">
          <Megaphone className="mb-3 h-10 w-10 text-slate-600" />
          <p className="font-medium text-slate-400">
            {search ? 'Sin resultados' : 'Sin campañas aún'}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {search ? 'Prueba con otro término' : 'Crea tu primera campaña para comenzar'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="card p-4 hover:border-brand/30 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white truncate">{c.name}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{c.client_name}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                    {c.start_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(c.start_date)} — {formatDate(c.end_date)}
                      </span>
                    )}
                    {c.budget && (
                      <span className="font-medium text-slate-400">{formatCurrency(c.budget)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
