import { useState, useEffect, useCallback } from 'react'
import { Search, MapPin, List, LayoutGrid, ChevronDown, ChevronUp, Save, Pencil, RefreshCw, Download, Image, Sparkles, X, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'
import { FORMAT_MAP } from '../../lib/constants'
import EditInventoryModal from '../../features/inventory/EditInventoryModal'
import InventoryImportExport, { RollbackBanner } from '../../features/inventory/InventoryImportExport'
import InventoryPhotosUpload from '../../features/inventory/InventoryPhotosUpload'
import InventoryOnboardingWizard from '../../features/inventory/InventoryOnboardingWizard'
import CorridorsManager from '../../features/inventory/CorridorsManager'

const FETCH_TIMEOUT_MS = 10_000

const FORMAT_ICON = {
  billboard:               '🏙️',
  digital:                 '📺',
  ambient:                 '🏢',
  poster:                  '📋',
  urban_furniture:         '🪧',
  urban_furniture_digital: '🖥️',
  mobile_screen:           '🚌',
}

const OWNER_TYPE_LABEL = {
  owned:  'Propio',
  rented: 'Alquilado',
}

// ── Helpers ───────────────────────────────────────────────────

function getItemPhotoUrl(item) {
  try {
    if (item.caras) {
      const arr = Array.isArray(item.caras)
        ? item.caras
        : JSON.parse(item.caras)
      const cara = arr.find(c => c?.photo_url)
      if (cara?.photo_url) return cara.photo_url
    }
  } catch (_) {}
  return item.photo_url || item.image_url || null
}

function AvailabilityBadge({ item }) {
  return (
    <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      item.is_available
        ? 'bg-teal-500/10 text-teal-400'
        : 'bg-red-500/10 text-red-400'
    }`}>
      {item.is_available ? 'Disponible' : 'Ocupado'}
    </span>
  )
}

function FormatBadges({ item }) {
  const fmt = FORMAT_MAP[item.format] ?? { label: item.format, color: '#64748b' }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
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
  )
}

// ── Vista lista ───────────────────────────────────────────────

function InventoryRow({ item, onEdit }) {
  const { isOwner, isManager } = useAuth()
  const canEdit = isOwner || isManager
  const fmt      = FORMAT_MAP[item.format] ?? { label: item.format, color: '#64748b' }
  const icon     = FORMAT_ICON[item.format] ?? '📍'
  const photoUrl = getItemPhotoUrl(item)
  const impactsPerMonth = item.daily_traffic ? item.daily_traffic * 3 : null
  const [lightbox, setLightbox] = useState(false)

  return (
    <div className="card px-3 py-2 hover:border-brand/30 transition-colors">
      <div className="flex items-center gap-3">

        {/* Foto thumbnail o ícono de formato */}
        {photoUrl ? (
          <>
            <div
              onClick={e => { e.stopPropagation(); setLightbox(true) }}
              className="flex h-10 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-surface-700 hover:border-brand/40 transition-colors"
              title="Ver foto"
            >
              <img src={photoUrl} alt={item.name} className="h-full w-full object-cover" />
            </div>
            {lightbox && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                onClick={() => setLightbox(false)}
              >
                <img
                  src={photoUrl}
                  alt={item.name}
                  className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl object-contain"
                  onClick={e => e.stopPropagation()}
                />
                <button
                  onClick={() => setLightbox(false)}
                  className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/80 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
                <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70 font-medium">
                  {item.name}
                </p>
              </div>
            )}
          </>
        ) : (
          <div
            className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg text-xl border border-surface-700"
            style={{ background: `${fmt.color}18` }}
          >
            {icon}
          </div>
        )}

        {/* Nombre + dirección + badges */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{item.name}</p>
            <span className="text-[11px] text-slate-600">{item.code}</span>
            {item.is_complete === false && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                <AlertCircle className="h-3 w-3" />
                Completar datos
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.address}{item.city ? `, ${item.city}` : ''}</span>
          </div>
          <div className="mt-1">
            <FormatBadges item={item} />
          </div>
        </div>

        {/* Métricas — ocultas en móvil pequeño */}
        <div className="hidden sm:flex items-center gap-6 shrink-0 text-[11px] text-slate-500">
          {item.daily_traffic && (
            <div className="text-right">
              <p>{item.daily_traffic.toLocaleString('es-AR')}</p>
              <p className="text-slate-600">tráfico/día</p>
            </div>
          )}
          {impactsPerMonth && (
            <div className="text-right">
              <p>{impactsPerMonth.toLocaleString('es-AR')}</p>
              <p className="text-slate-600">impactos/mes</p>
            </div>
          )}
          {item.base_rate && (
            <div className="text-right">
              <p className="font-semibold text-slate-200">{formatCurrency(item.base_rate)}</p>
              <p className="text-slate-600">mensual</p>
            </div>
          )}
        </div>

        {/* Disponibilidad */}
        <AvailabilityBadge item={item} />

        {/* Editar */}
        {canEdit && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onEdit(item) }}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-surface-700 text-slate-500 hover:border-brand/50 hover:text-brand transition-colors"
            title="Editar cartel"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Libre desde */}
      {!item.is_available && item.available_until && (
        <p className="mt-1 pl-11 text-[11px] text-amber-400">
          Libre desde: {formatDate(item.available_until)}
        </p>
      )}
    </div>
  )
}

// ── Banda Negativa inline editor ──────────────────────────────

function BandaNegativaSection({ item }) {
  const [open,      setOpen]      = useState(false)
  const [enabled,   setEnabled]   = useState(item.banda_negativa_enabled ?? false)
  const [rate,      setRate]      = useState(item.banda_negativa_rate ?? 0)
  const [minMonths, setMinMonths] = useState(item.banda_negativa_min_months ?? 6)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  async function handleSave() {
    setSaving(true)
    await supabase.from('inventory')
      .update({ banda_negativa_enabled: enabled, banda_negativa_rate: rate, banda_negativa_min_months: minMonths })
      .eq('id', item.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const exposurePct = item.base_rate && rate > 0
    ? Math.round((rate / item.base_rate) * 100)
    : 60

  return (
    <div className="border-t border-surface-700">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-0 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-amber-400' : 'bg-slate-600'}`} />
          Banda negativa {enabled ? '· Activa' : '· Inactiva'}
        </span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Activar banda negativa</span>
            <button
              type="button"
              onClick={() => setEnabled(v => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${enabled ? 'bg-brand' : 'bg-surface-700'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>

          {enabled && (
            <>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Precio banda negativa (ARS)</label>
                <input type="number" className="input-field text-xs py-1.5"
                  value={rate} min={0} onChange={e => setRate(Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Período mínimo (meses)</label>
                <input type="number" className="input-field text-xs py-1.5"
                  value={minMonths} min={1} onChange={e => setMinMonths(Number(e.target.value))} />
              </div>
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-2.5 py-2 text-xs text-amber-300/80">
                Exposición estimada: <strong className="text-amber-300">~{exposurePct}% del tiempo contratado</strong>
              </div>
            </>
          )}

          <button type="button" onClick={handleSave} disabled={saving}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand/10 border border-brand/20 py-1.5 text-xs font-medium text-brand hover:bg-brand/20 transition-colors disabled:opacity-50">
            <Save className="h-3 w-3" />
            {saved ? 'Guardado ✓' : saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Vista grilla ──────────────────────────────────────────────

function InventoryCard({ item, onEdit }) {
  // Leer el rol directamente desde el contexto para evitar
  // desincronización con el prop drilling
  const { isOwner, isManager } = useAuth()
  const canEdit = isOwner || isManager

  const fmt  = FORMAT_MAP[item.format] ?? { label: item.format, color: '#64748b' }
  const icon = FORMAT_ICON[item.format] ?? '📍'
  const impactsPerMonth = item.daily_traffic ? item.daily_traffic * 3 : null
  const photoUrl = getItemPhotoUrl(item)

  // Costos fijos (columnas migration_v3)
  const totalCosts = (item.cost_rent ?? 0)
    + (item.cost_electricity ?? 0)
    + (item.cost_taxes ?? 0)
    + (item.cost_maintenance ?? 0)
    + (item.cost_imponderables ?? 0)
  const hasCosts = totalCosts > 0

  return (
    <div className="card overflow-hidden hover:border-brand/30 transition-colors">

      {/* Foto o placeholder */}
      {photoUrl ? (
        <img src={photoUrl} alt={item.name}
          className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-28 items-center justify-center text-5xl"
          style={{ background: `${fmt.color}18` }}>
          {icon}
        </div>
      )}

      <div className="p-4 space-y-3">

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{item.name}</p>
            <p className="text-xs text-slate-500">{item.code}</p>
            {item.is_complete === false && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                <AlertCircle className="h-3 w-3" />
                Completar datos
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <AvailabilityBadge item={item} />
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-700 text-slate-500 hover:border-brand/50 hover:text-brand transition-colors"
                title="Editar cartel"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {!item.is_available && item.available_until && (
          <p className="text-xs text-amber-400">
            Libre desde: {formatDate(item.available_until)}
          </p>
        )}

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{item.address}{item.city ? `, ${item.city}` : ''}</span>
        </div>

        <FormatBadges item={item} />

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

        {/* Costos fijos (solo owner) */}
        {isOwner && hasCosts && (
          <div className="rounded-lg border border-brand/20 bg-brand/5 p-2.5 space-y-1">
            <p className="text-xs font-semibold text-brand mb-1.5">Costos mensuales</p>
            {item.cost_rent > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Alquiler</span>
                <span className="text-slate-300">{formatCurrency(item.cost_rent)}</span>
              </div>
            )}
            {item.cost_electricity > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Luz</span>
                <span className="text-slate-300">{formatCurrency(item.cost_electricity)}</span>
              </div>
            )}
            {item.cost_taxes > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Impuestos</span>
                <span className="text-slate-300">{formatCurrency(item.cost_taxes)}</span>
              </div>
            )}
            {item.base_rate && (
              <div className="flex justify-between text-xs border-t border-brand/10 pt-1.5">
                <span className="text-slate-400 font-medium">Margen estimado</span>
                <span className="font-bold text-teal-400">
                  {formatCurrency(item.base_rate - totalCosts)}
                </span>
              </div>
            )}
          </div>
        )}

        {item.latitude && item.longitude && (
          <p className="text-xs text-slate-600">
            {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
          </p>
        )}

        {/* Banda negativa — owner o manager */}
        {(isOwner || isManager) && (
          <BandaNegativaSection item={item} />
        )}

      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function Inventory() {
  const { profile, isOwner, isManager } = useAuth()
  const canAdmin = isOwner || isManager
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [search,       setSearch]       = useState('')
  const [filterZone,   setFilterZone]   = useState('')
  const [filterFormat, setFilterFormat] = useState('')
  const [filterAvail,  setFilterAvail]  = useState('')
  const [viewMode, setViewMode]   = useState(
    () => localStorage.getItem('inventory_view') ?? 'list'
  )
  const [editingItem, setEditingItem]           = useState(null)
  const [showImportExport, setShowImportExport] = useState(false)
  const [showPhotosUpload, setShowPhotosUpload] = useState(false)
  const [showOnboarding,  setShowOnboarding]   = useState(false)
  const [activeTab, setActiveTab]               = useState('items') // 'items' | 'corridors'

  function toggleView(mode) {
    setViewMode(mode)
    localStorage.setItem('inventory_view', mode)
  }

  const loadItems = useCallback(async () => {
    if (!profile?.org_id) return
    setLoading(true)
    setFetchError('')

    // AbortController para timeout de 10 segundos
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)

      clearTimeout(timer)

      if (error) throw error
      setItems(data ?? [])
    } catch (err) {
      const msg = err?.name === 'AbortError' || err?.message?.includes('abort')
        ? 'La consulta tardó demasiado. Verificá tu conexión e intentá de nuevo.'
        : (err?.message ?? 'Error al cargar el inventario')
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { loadItems() }, [loadItems])

  function handleSaved() {
    setEditingItem(null)
    loadItems()
  }

  const zones = [...new Set(items.map(i => i.city).filter(Boolean))].sort()

  const filtered = items.filter(item => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      item.name?.toLowerCase().includes(q) ||
      item.code?.toLowerCase().includes(q) ||
      item.address?.toLowerCase().includes(q)
    const matchZone   = !filterZone   || item.city === filterZone
    const matchFormat = !filterFormat || item.format === filterFormat
    const matchAvail  = !filterAvail  || String(item.is_available) === filterAvail
    return matchSearch && matchZone && matchFormat && matchAvail
  })

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Inventario</h2>
          <p className="text-sm text-slate-500">{items.length} espacios registrados</p>
        </div>

        {/* Acciones owner/manager */}
        {canAdmin && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOnboarding(true)}
              className="flex items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-xs font-medium text-slate-300 hover:border-brand/40 hover:text-white transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              Cargar inventario
            </button>
            <button type="button" onClick={() => setShowPhotosUpload(true)}
              className="flex items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-brand/50 hover:text-slate-200 transition-colors">
              <Image className="h-3.5 w-3.5" />
              Subir fotos
            </button>
            <button type="button" onClick={() => setShowImportExport(true)}
              className="flex items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-brand/50 hover:text-slate-200 transition-colors">
              <Download className="h-3.5 w-3.5" />
              Importar / Exportar
            </button>
          </div>
        )}

        {/* Toggle lista / grilla */}
        <div className="flex items-center rounded-lg border border-surface-700 bg-surface-800 p-0.5">
          <button type="button" onClick={() => toggleView('list')}
            className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
              viewMode === 'list' ? 'bg-brand text-white' : 'text-slate-500 hover:text-slate-200'
            }`} title="Vista lista">
            <List className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => toggleView('grid')}
            className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
              viewMode === 'grid' ? 'bg-brand text-white' : 'text-slate-500 hover:text-slate-200'
            }`} title="Vista tablero">
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs (owner/manager only) */}
      {canAdmin && (
        <div className="flex gap-1 rounded-xl border border-surface-700 bg-surface-800 p-1 w-fit">
          {[
            { id: 'items',    label: 'Carteles' },
            { id: 'corridors', label: 'Corredores' },
          ].map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === t.id ? 'bg-brand text-white' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Rollback banner */}
      {profile?.org_id && activeTab === 'items' && (
        <RollbackBanner orgId={profile.org_id} onRollbackDone={loadItems} />
      )}

      {/* Corredores tab */}
      {activeTab === 'corridors' && (
        <CorridorsManager items={items} />
      )}

      {/* Items tab */}
      {activeTab === 'items' && <>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input-field pl-9 text-xs" placeholder="Buscar nombre, código, dirección…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <select value={filterZone} onChange={e => setFilterZone(e.target.value)}
          className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand/50">
          <option value="">Todas las zonas</option>
          {zones.map(z => <option key={z} value={z}>{z}</option>)}
        </select>

        <select value={filterFormat} onChange={e => setFilterFormat(e.target.value)}
          className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand/50">
          <option value="">Todos los formatos</option>
          {Object.entries(FORMAT_MAP).map(([k, v]) =>
            <option key={k} value={k}>{v.label}</option>
          )}
        </select>

        <select value={filterAvail} onChange={e => setFilterAvail(e.target.value)}
          className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand/50">
          <option value="">Disponibilidad</option>
          <option value="true">Disponibles</option>
          <option value="false">Ocupados</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 py-16 text-center px-6">
          <p className="text-sm font-medium text-red-400">{fetchError}</p>
          <button
            type="button"
            onClick={loadItems}
            className="mt-4 flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-800 px-4 py-2 text-sm font-medium text-slate-300 hover:border-brand/50 hover:text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16 text-center">
          <MapPin className="mb-3 h-10 w-10 text-slate-600" />
          <p className="font-medium text-slate-400">{search ? 'Sin resultados' : 'Sin espacios registrados'}</p>
          <p className="mt-1 text-sm text-slate-600">
            {search ? 'Probá con otro término' : 'Ejecutá el seed en Supabase para agregar carteles de prueba'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {filtered.map(item => (
            <InventoryRow key={item.id} item={item} onEdit={setEditingItem} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => (
            <InventoryCard key={item.id} item={item} onEdit={setEditingItem} />
          ))}
        </div>
      )}

      </> /* end items tab */}

      {/* Edit modal */}
      {editingItem && (
        <EditInventoryModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Import / Export modal */}
      {showImportExport && (
        <InventoryImportExport
          items={items}
          orgName={profile?.organisations?.name}
          orgId={profile?.org_id}
          onImported={() => loadItems()}
          onClose={() => setShowImportExport(false)}
        />
      )}

      {showOnboarding && (
        <InventoryOnboardingWizard
          onClose={() => setShowOnboarding(false)}
          onComplete={() => {
            setShowOnboarding(false)
            loadItems()
          }}
        />
      )}

      {/* Bulk photos upload modal */}
      {showPhotosUpload && (
        <InventoryPhotosUpload
          items={items}
          orgId={profile?.org_id}
          onDone={() => { loadItems(); setShowPhotosUpload(false) }}
          onClose={() => setShowPhotosUpload(false)}
        />
      )}
    </div>
  )
}
