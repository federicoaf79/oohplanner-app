import { useState, useEffect } from 'react'
import { Search, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'
import { FORMAT_MAP } from '../../lib/constants'

const FORMAT_ICON = {
  billboard:       '🏙️',
  digital:         '📺',
  ambient:         '🏢',
  transit:         '🚌',
  street_furniture:'🪧',
}

const OWNER_TYPE_LABEL = {
  owned:  'Propio',
  rented: 'Alquilado',
}

export default function Inventory() {
  const { profile, isOwner } = useAuth()
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [search, setSearch]   = useState('')

  useEffect(() => {
    if (!profile?.org_id) return
    setLoading(true)
    supabase
      .from('inventory')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setFetchError(error.message)
        setItems(data ?? [])
        setLoading(false)
      })
  }, [profile?.org_id])

  const filtered = items.filter(i =>
    (i.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (i.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (i.code ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Inventario</h2>
          <p className="text-sm text-slate-500">{items.length} espacios registrados</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input className="input-field pl-9" placeholder="Buscar por nombre, ciudad o código..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : fetchError ? (
        <p className="text-center text-sm text-red-400 py-8">{fetchError}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16 text-center">
          <MapPin className="mb-3 h-10 w-10 text-slate-600" />
          <p className="font-medium text-slate-400">{search ? 'Sin resultados' : 'Sin espacios registrados'}</p>
          <p className="mt-1 text-sm text-slate-600">
            {search ? 'Probá con otro término' : 'Ejecutá el seed en Supabase para agregar carteles de prueba'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => (
            <InventoryCard key={item.id} item={item} isOwner={isOwner} />
          ))}
        </div>
      )}
    </div>
  )
}

function InventoryCard({ item, isOwner }) {
  const fmt  = FORMAT_MAP[item.format] ?? { label: item.format, color: '#64748b' }
  const icon = FORMAT_ICON[item.format] ?? '📍'
  const impactsPerMonth = item.daily_traffic ? item.daily_traffic * 3 : null

  const totalCosts = (item.monthly_rent ?? 0)
    + (item.monthly_electricity ?? 0)
    + (item.monthly_taxes ?? 0)
  const hasCosts = totalCosts > 0

  return (
    <div className="card overflow-hidden hover:border-brand/30 transition-colors cursor-pointer">

      {/* Placeholder visual por formato */}
      <div className="flex h-28 items-center justify-center text-5xl"
        style={{ background: `${fmt.color}18` }}>
        {icon}
      </div>

      <div className="p-4 space-y-3">

        {/* Nombre + estado */}
        <div className="flex items-start justify-between gap-2">
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

        {/* Libre desde (si está ocupado) */}
        {!item.is_available && item.available_until && (
          <p className="text-xs text-amber-400">
            Libre desde: {formatDate(item.available_until)}
          </p>
        )}

        {/* Dirección */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{item.address}{item.city ? `, ${item.city}` : ''}</span>
        </div>

        {/* Formato + tipo de propiedad */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: `${fmt.color}20`, color: fmt.color }}>
            {fmt.label}
          </span>
          {item.owner_type && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-surface-700 text-slate-400">
              {OWNER_TYPE_LABEL[item.owner_type] ?? item.owner_type}
            </span>
          )}
          {item.illuminated && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-500/10 text-yellow-400">
              Iluminado
            </span>
          )}
        </div>

        {/* Tráfico e impactos */}
        {item.daily_traffic ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface-800 px-2.5 py-1.5">
              <p className="text-xs text-slate-500">Tráfico diario</p>
              <p className="text-sm font-semibold text-slate-200">
                {item.daily_traffic.toLocaleString('es-AR')}
              </p>
            </div>
            <div className="rounded-lg bg-surface-800 px-2.5 py-1.5">
              <p className="text-xs text-slate-500">Impactos/mes</p>
              <p className="text-sm font-semibold text-slate-200">
                {impactsPerMonth.toLocaleString('es-AR')}
              </p>
            </div>
          </div>
        ) : null}

        {/* Precios */}
        {item.base_rate ? (
          <div className="flex items-center justify-between border-t border-surface-700 pt-2.5">
            <div>
              <p className="text-xs text-slate-500">Mensual</p>
              <p className="text-sm font-bold text-white">{formatCurrency(item.base_rate)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Quincenal</p>
              <p className="text-sm font-semibold text-slate-300">{formatCurrency(item.base_rate / 2)}</p>
            </div>
          </div>
        ) : null}

        {/* Costos — solo visible para owner */}
        {isOwner && hasCosts && (
          <div className="rounded-lg border border-brand/20 bg-brand/5 p-2.5 space-y-1">
            <p className="text-xs font-semibold text-brand mb-1.5">Costos</p>
            {item.monthly_rent > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Alquiler</span>
                <span className="text-slate-300">{formatCurrency(item.monthly_rent)}</span>
              </div>
            )}
            {item.monthly_electricity > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Luz</span>
                <span className="text-slate-300">{formatCurrency(item.monthly_electricity)}</span>
              </div>
            )}
            {item.monthly_taxes > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Impuestos</span>
                <span className="text-slate-300">{formatCurrency(item.monthly_taxes)}</span>
              </div>
            )}
            {item.base_rate && (
              <div className="flex justify-between text-xs border-t border-brand/10 pt-1.5">
                <span className="text-slate-400 font-medium">Margen estimado</span>
                <span className="font-bold text-emerald-400">
                  {formatCurrency(item.base_rate - totalCosts)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Coordenadas */}
        {item.latitude && item.longitude && (
          <p className="text-xs text-slate-600">
            {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
          </p>
        )}

      </div>
    </div>
  )
}
