import { useState, useEffect } from 'react'
import { Crosshair, ImageOff, LayoutGrid, List } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/ui/Spinner'
import BillboardZoneEditor from '../../features/inventory/BillboardZoneEditor'

const FILTERS = [
  { id: 'all',     label: 'Todos' },
  { id: 'no_zone', label: 'Sin zona' },
  { id: 'no_photo',label: 'Sin foto' },
  { id: 'ready',   label: 'Listos' },
]

function itemStatus(item) {
  const caras = Array.isArray(item.caras) ? item.caras : []
  const hasZone  = caras.some(c => c.billboard_zone != null)
  const hasPhoto = caras.some(c => c.photo_url) || item.photo_url || item.image_url
  if (hasZone)  return 'ready'
  if (hasPhoto) return 'no_zone'
  return 'no_photo'
}

function getThumbUrl(item) {
  const caras = Array.isArray(item.caras) ? item.caras : []
  return caras[0]?.photo_url ?? item.photo_url ?? item.image_url ?? null
}

export default function ZoneEditor() {
  const { profile } = useAuth()
  const orgId = profile?.org_id ?? null

  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [filter,   setFilter]   = useState('all')
  const [viewMode, setViewMode] = useState('grid')
  const [editing,  setEditing]  = useState(null) // { item, caraIndex }

  useEffect(() => {
    if (!orgId) return
    loadItems()
  }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadItems() {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('inventory')
        .select('id, code, name, address, format, caras, photo_url, image_url')
        .eq('org_id', orgId)
        .order('name')
      if (err) throw new Error(err.message)
      setItems(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSaved(updated) {
    setItems(prev => prev.map(it => it.id === updated.id ? { ...it, ...updated } : it))
    setEditing(prev => prev ? { ...prev, item: updated } : null)
  }

  const filtered = items.filter(it => {
    if (filter === 'all') return true
    return itemStatus(it) === filter
  })

  const readyCount = items.filter(it => itemStatus(it) === 'ready').length

  return (
    <div className="min-h-screen bg-surface-900 text-white">

      {/* Header */}
      <div className="border-b border-surface-700 bg-surface-800 px-6 py-5">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <Crosshair className="h-5 w-5 text-brand" />
                <h1 className="text-lg font-bold text-white">Editor de Zonas</h1>
              </div>
              <p className="text-sm text-slate-500">
                Marcá la superficie de anuncio en cada cartel para generar mockups
              </p>
            </div>
            {!loading && (
              <div className="shrink-0 rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-2 text-center">
                <p className="text-xl font-bold text-white">{readyCount}<span className="text-slate-500 text-sm font-normal"> / {items.length}</span></p>
                <p className="text-xs text-slate-500 mt-0.5">con zona marcada</p>
              </div>
            )}
          </div>

          {/* Filters + view toggle */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  filter === f.id
                    ? 'bg-brand text-white'
                    : 'bg-surface-700 text-slate-400 hover:text-white hover:bg-surface-600'
                }`}
              >
                {f.label}
                {f.id !== 'all' && (
                  <span className="ml-1.5 opacity-60">
                    ({items.filter(it => itemStatus(it) === f.id).length})
                  </span>
                )}
              </button>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-brand text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-brand text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        {loading && (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="py-20 text-center text-slate-500 text-sm">
            {filter === 'all' ? 'No hay carteles en tu inventario.' : 'No hay carteles en esta categoría.'}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (() => {
          const StatusBadge = ({ status }) => (
            <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              status === 'ready'    ? 'bg-teal-500 text-white' :
              status === 'no_zone' ? 'bg-amber-500/20 text-amber-400' :
                                     'bg-surface-700 text-slate-500'
            }`}>
              {status === 'ready' ? '✓ Listo' : status === 'no_zone' ? 'Marcar zona' : 'Sin foto'}
            </span>
          )

          return viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(item => {
                const status = itemStatus(item)
                const thumb  = getThumbUrl(item)
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-surface-700 bg-surface-800 overflow-hidden flex flex-col hover:border-surface-600 transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-surface-900 flex items-center justify-center overflow-hidden">
                      {thumb
                        ? <img src={thumb} alt={item.name} className="w-full h-full object-cover" />
                        : <ImageOff className="h-10 w-10 text-slate-700" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex flex-col gap-3 p-4 flex-1">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-xs text-slate-500 truncate min-w-0">
                            <span className="font-mono text-slate-600">{item.code}</span>
                            {item.address ? ' · ' + item.address : ''}
                          </span>
                          <StatusBadge status={status} />
                        </div>
                      </div>

                      <button
                        onClick={() => setEditing({ item, caraIndex: 0 })}
                        className={`w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          status === 'ready'
                            ? 'border border-surface-600 bg-surface-700 text-slate-300 hover:bg-surface-600'
                            : status === 'no_zone'
                            ? 'bg-brand text-white hover:bg-brand/90'
                            : 'border border-surface-600 bg-surface-700 text-slate-400 hover:bg-surface-600'
                        }`}
                      >
                        {status === 'ready' ? 'Editar zona' : status === 'no_zone' ? 'Marcar zona' : 'Subir foto y marcar zona'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(item => {
                const status = itemStatus(item)
                const thumb  = getThumbUrl(item)
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-3 rounded-xl border border-surface-700 bg-surface-800/50 hover:border-brand/30 transition-colors"
                  >
                    {thumb
                      ? <img src={thumb} alt={item.name} className="h-14 w-20 object-cover rounded-lg shrink-0" />
                      : <div className="h-14 w-20 shrink-0 rounded-lg bg-surface-700 flex items-center justify-center">
                          <ImageOff className="h-5 w-5 text-slate-600" />
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        <span className="font-mono text-slate-600">{item.code}</span>
                        {item.address ? ' · ' + item.address : ''}
                      </p>
                    </div>
                    <StatusBadge status={status} />
                    <button
                      onClick={() => setEditing({ item, caraIndex: 0 })}
                      className="shrink-0 rounded-lg border border-surface-700 px-3 py-1.5 text-xs text-slate-300 hover:border-brand/40 hover:text-white transition-colors"
                    >
                      {status === 'ready' ? 'Editar zona' : 'Marcar zona'}
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Zone editor modal */}
      {editing && (
        <BillboardZoneEditor
          item={editing.item}
          caraIndex={editing.caraIndex}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
