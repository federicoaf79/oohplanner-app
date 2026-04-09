import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, MapPin, ChevronDown, ChevronUp, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'

// ── Modal de creación/edición ────────────────────────────────

function CorridorModal({ corridor, items, orgId, onSaved, onClose }) {
  const isNew = !corridor?.id

  const [name,        setName]        = useState(corridor?.name ?? '')
  const [description, setDescription] = useState(corridor?.description ?? '')
  const [selectedIds, setSelectedIds] = useState(new Set(corridor?.inventory_ids ?? []))
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [search,      setSearch]      = useState('')

  const filtered = items.filter(i =>
    (i.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (i.address ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (i.city ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function toggleItem(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!name.trim()) { setError('El nombre del corredor es requerido.'); return }
    setSaving(true)
    setError('')

    const payload = {
      org_id:        orgId,
      name:          name.trim(),
      description:   description.trim() || null,
      inventory_ids: [...selectedIds],
      active:        true,
    }

    try {
      if (isNew) {
        const { error } = await supabase.from('corridors').insert(payload)
        if (error) throw error
      } else {
        const { error } = await supabase.from('corridors').update(payload).eq('id', corridor.id)
        if (error) throw error
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-700 px-5 py-4">
          <p className="font-semibold text-white">{isNew ? 'Nuevo corredor' : 'Editar corredor'}</p>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-700 transition-colors">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Nombre del corredor *</label>
            <input className={`input-field ${error && !name.trim() ? 'border-red-500' : ''}`}
              placeholder="Ej: Corredor Norte — Libertador"
              value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* Descripción */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Descripción (opcional)</label>
            <textarea className="input-field min-h-[72px] resize-none"
              placeholder="Ej: Zona de alto tráfico vehicular en el eje norte de CABA"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Selección de carteles */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">
                Carteles ({selectedIds.size} seleccionados)
              </label>
              {selectedIds.size > 0 && (
                <button type="button" onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  Limpiar selección
                </button>
              )}
            </div>

            <input className="input-field mb-2 text-sm"
              placeholder="Buscar por nombre, dirección o ciudad..."
              value={search} onChange={e => setSearch(e.target.value)} />

            <div className="max-h-56 overflow-y-auto rounded-xl border border-surface-700 divide-y divide-surface-700">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-600">
                  {search ? 'Sin resultados' : 'No hay carteles en el inventario'}
                </p>
              ) : filtered.map(item => {
                const checked = selectedIds.has(item.id)
                return (
                  <label key={item.id}
                    className={`flex items-start gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                      checked ? 'bg-brand/5' : 'hover:bg-surface-800'
                    }`}>
                    <input type="checkbox" checked={checked}
                      onChange={() => toggleItem(item.id)}
                      className="mt-0.5 h-4 w-4 rounded accent-brand shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {item.address}{item.city ? `, ${item.city}` : ''}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-surface-700 px-5 py-4">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-lg border border-surface-700 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Cancelar
          </button>
          <Button className="flex-1" onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            {isNew ? 'Crear corredor' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de corredor ─────────────────────────────────────

function CorridorCard({ corridor, items, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  const corridorItems = (corridor.inventory_ids ?? [])
    .map(id => items.find(i => i.id === id))
    .filter(Boolean)

  return (
    <div className="card overflow-hidden hover:border-brand/30 transition-colors">
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand font-bold text-lg">
          📍
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{corridor.name}</p>
          {corridor.description && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{corridor.description}</p>
          )}
          <p className="text-xs text-slate-600 mt-1">
            {corridorItems.length} {corridorItems.length === 1 ? 'cartel' : 'carteles'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => setExpanded(v => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-700 text-slate-500 hover:border-brand/50 hover:text-brand transition-colors"
            title={expanded ? 'Ocultar carteles' : 'Ver carteles'}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => onEdit(corridor)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-700 text-slate-500 hover:border-brand/50 hover:text-brand transition-colors"
            title="Editar corredor">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onDelete(corridor.id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-700 text-slate-500 hover:border-red-500/50 hover:text-red-400 transition-colors"
            title="Eliminar corredor">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && corridorItems.length > 0 && (
        <div className="border-t border-surface-700 px-4 pb-3 space-y-1">
          {corridorItems.map(item => (
            <div key={item.id} className="flex items-center gap-2 py-1.5 text-xs text-slate-400">
              <MapPin className="h-3 w-3 text-slate-600 shrink-0" />
              <span className="font-medium text-slate-300">{item.name}</span>
              <span className="text-slate-600">—</span>
              <span className="truncate">{item.address}{item.city ? `, ${item.city}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────

export default function CorridorsManager({ items }) {
  const { profile } = useAuth()
  const [corridors,      setCorridors]      = useState([])
  const [loading,        setLoading]        = useState(false)
  const [editingCorridor, setEditingCorridor] = useState(null) // null = closed, {} = new, {...} = edit
  const [showModal,      setShowModal]      = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(null) // corridor id
  const [deleting,       setDeleting]       = useState(false)

  async function loadCorridors() {
    if (!profile?.org_id) return
    setLoading(true)
    const { data } = await supabase
      .from('corridors')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('active', true)
      .order('created_at', { ascending: false })
    setCorridors(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadCorridors() }, [profile?.org_id])

  function handleEdit(corridor) {
    setEditingCorridor(corridor)
    setShowModal(true)
  }

  function handleNew() {
    setEditingCorridor({})
    setShowModal(true)
  }

  async function handleDelete(id) {
    setDeleting(true)
    await supabase.from('corridors').update({ active: false }).eq('id', id)
    setConfirmDelete(null)
    setDeleting(false)
    loadCorridors()
  }

  function handleSaved() {
    setShowModal(false)
    setEditingCorridor(null)
    loadCorridors()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {corridors.length} {corridors.length === 1 ? 'corredor definido' : 'corredores definidos'}
          </p>
        </div>
        <Button onClick={handleNew} size="sm">
          <Plus className="h-4 w-4" />
          Nuevo corredor
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : corridors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16 text-center">
          <p className="text-2xl mb-3">📍</p>
          <p className="font-medium text-slate-400">Sin corredores</p>
          <p className="mt-1 text-sm text-slate-600">
            Creá un corredor agrupando carteles de una misma zona o ruta publicitaria.
          </p>
          <button type="button" onClick={handleNew}
            className="mt-4 flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-4 py-2 text-sm font-medium text-brand hover:bg-brand/20 transition-colors">
            <Plus className="h-4 w-4" />
            Crear primer corredor
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {corridors.map(corridor => (
            <CorridorCard
              key={corridor.id}
              corridor={corridor}
              items={items}
              onEdit={handleEdit}
              onDelete={id => setConfirmDelete(id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && editingCorridor !== null && (
        <CorridorModal
          corridor={editingCorridor.id ? editingCorridor : null}
          items={items}
          orgId={profile?.org_id}
          onSaved={handleSaved}
          onClose={() => { setShowModal(false); setEditingCorridor(null) }}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-surface-700 bg-surface-900 p-6 shadow-2xl">
            <p className="text-base font-semibold text-white mb-2">¿Eliminar corredor?</p>
            <p className="text-sm text-slate-400 mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-lg border border-surface-700 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={() => handleDelete(confirmDelete)} disabled={deleting}
                className="flex-1 rounded-lg bg-red-500/10 border border-red-500/30 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
