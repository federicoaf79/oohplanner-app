import { useState, useEffect } from 'react'
import { Plus, Search, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { formatCurrency } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'

export default function Inventory() {
  const { profile } = useAuth()
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    if (!profile?.org_id) return
    supabase
      .from('inventory')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data ?? []); setLoading(false) })
  }, [profile?.org_id])

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.city?.toLowerCase().includes(search.toLowerCase()) ||
    i.code?.toLowerCase().includes(search.toLowerCase())
  )

  const FORMAT_LABELS = {
    billboard: 'Espectacular',
    transit: 'Transporte',
    street_furniture: 'Mobiliario urbano',
    digital: 'Digital',
    ambient: 'Ambient',
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Inventario</h2>
          <p className="text-sm text-slate-500">{items.length} espacios registrados</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Agregar espacio
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input className="input-field pl-9" placeholder="Buscar por nombre, ciudad o código..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16 text-center">
          <MapPin className="mb-3 h-10 w-10 text-slate-600" />
          <p className="font-medium text-slate-400">{search ? 'Sin resultados' : 'Sin espacios registrados'}</p>
          <p className="mt-1 text-sm text-slate-600">Agrega tu primer espacio publicitario</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => (
            <div key={item.id} className="card p-4 hover:border-brand/30 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.code}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  item.is_available
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {item.is_available ? 'Disponible' : 'Ocupado'}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  {item.city} {item.address && `· ${item.address}`}
                </div>
                <div className="flex items-center justify-between">
                  <span>{FORMAT_LABELS[item.format] ?? item.format}</span>
                  {item.base_rate && (
                    <span className="font-semibold text-slate-300">{formatCurrency(item.base_rate)}/mes</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
