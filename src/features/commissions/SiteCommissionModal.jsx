import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const EMPTY = {
  site_id: '',
  contact_id: '',
  commission_type: 'location_facilitator',
  commission_pct: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  notes: '',
}

export default function SiteCommissionModal({ mode, facilitator, onClose, onSaved }) {
  const { org, profile } = useAuth()
  const isEdit = mode === 'edit'

  const [form, setForm] = useState(() => isEdit && facilitator ? {
    site_id:         facilitator.site_id        ?? '',
    contact_id:      facilitator.contact_id     ?? '',
    commission_type: facilitator.commission_type ?? 'location_facilitator',
    commission_pct:  facilitator.commission_pct  ?? '',
    start_date:      facilitator.start_date      ?? new Date().toISOString().split('T')[0],
    end_date:        facilitator.end_date        ?? '',
    notes:           facilitator.notes          ?? '',
  } : { ...EMPTY })

  const [sites, setSites]       = useState([])
  const [contacts, setContacts] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    Promise.all([
      supabase.from('inventory')
        .select('id, name, code, address, owner_type')
        .eq('org_id', org.id)
        .order('name'),
      supabase.from('contacts')
        .select('id, name, legal_name, roles')
        .eq('org_id', org.id)
        .eq('is_active', true)
        .order('name'),
    ]).then(([invR, ctR]) => {
      setSites(invR.data ?? [])
      setContacts(ctR.data ?? [])
      setLoadingData(false)
    })
  }, [org.id])

  const missingPrereqs = !loadingData && (sites.length === 0 || contacts.length === 0)

  const pctNum = parseFloat(form.commission_pct)
  const pctInvalid = form.commission_pct !== '' && (isNaN(pctNum) || pctNum < 0 || pctNum > 100)
  const dateInvalid = form.end_date && form.start_date && form.end_date <= form.start_date

  async function handleSubmit(e) {
    e.preventDefault()
    if (pctInvalid || dateInvalid) return
    setSaving(true)
    setError(null)

    const payload = {
      org_id:          org.id,
      site_id:         form.site_id,
      contact_id:      form.contact_id,
      commission_type: form.commission_type,
      commission_pct:  parseFloat(form.commission_pct),
      start_date:      form.start_date,
      end_date:        form.end_date || null,
      notes:           form.notes.trim() || null,
    }

    const result = isEdit
      ? await supabase.from('site_commissions').update(payload).eq('id', facilitator.id)
      : await supabase.from('site_commissions').insert({ ...payload, is_active: true, created_by: profile.id })

    setSaving(false)
    if (result.error) { setError(result.error.message); return }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full md:max-w-2xl flex-col rounded-2xl border border-slate-700 bg-surface-800 shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-surface-700 px-6 py-4">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? 'Editar facilitador' : 'Agregar facilitador'}
          </h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loadingData ? (
          <div className="flex flex-1 items-center justify-center py-16 text-slate-500">Cargando…</div>
        ) : missingPrereqs ? (
          <div className="flex-1 px-6 py-8 text-center">
            <p className="font-medium text-slate-300">Faltan datos previos</p>
            <p className="mt-2 text-sm text-slate-500">
              Necesitás al menos 1 cartel y 1 contacto activo antes de configurar facilitadores.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <a href="/inventory" className="btn-secondary text-sm">Ir a Inventario</a>
              <a href="/contacts"  className="btn-secondary text-sm">Ir a Contactos</a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              {/* Cartel */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Cartel *</label>
                <select
                  required
                  value={form.site_id}
                  onChange={e => set('site_id', e.target.value)}
                  className="input-field"
                >
                  <option value="">Seleccionar cartel…</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.code ? ` (${s.code})` : ''}{s.address ? ` — ${s.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contacto */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Contacto *</label>
                <select
                  required
                  value={form.contact_id}
                  onChange={e => set('contact_id', e.target.value)}
                  className="input-field"
                >
                  <option value="">Seleccionar contacto…</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.legal_name ? ` — ${c.legal_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400">Tipo *</label>
                <div className="space-y-2">
                  {[
                    {
                      value: 'location_facilitator',
                      label: 'Facilitador de locación',
                      helper: 'Te consiguió el acceso a la locación del cartel',
                    },
                    {
                      value: 'management_contract',
                      label: 'Contrato de comercialización',
                      helper: 'Es el dueño del cartel y te cede la venta',
                    },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        form.commission_type === opt.value
                          ? 'border-brand/60 bg-brand/10'
                          : 'border-surface-700 hover:border-surface-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="commission_type"
                        value={opt.value}
                        checked={form.commission_type === opt.value}
                        onChange={() => set('commission_type', opt.value)}
                        className="mt-0.5 accent-brand"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-200">{opt.label}</p>
                        <p className="text-xs text-slate-500">{opt.helper}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* % Comisión + Fechas */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">% Comisión *</label>
                  <div className="relative">
                    <input
                      type="number" min="0" max="100" step="0.5" required
                      value={form.commission_pct}
                      onChange={e => set('commission_pct', e.target.value)}
                      className={`input-field pr-7 ${pctInvalid ? 'border-red-500' : ''}`}
                      placeholder="0.00"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                  </div>
                  {pctInvalid && <p className="mt-1 text-xs text-red-400">Debe estar entre 0 y 100</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Desde *</label>
                  <input
                    type="date" required
                    value={form.start_date}
                    onChange={e => set('start_date', e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">
                    Hasta <span className="text-slate-600">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => set('end_date', e.target.value)}
                    className={`input-field ${dateInvalid ? 'border-red-500' : ''}`}
                  />
                  {dateInvalid
                    ? <p className="mt-1 text-xs text-red-400">Debe ser posterior a "Desde"</p>
                    : <p className="mt-1 text-xs text-slate-600">Vacío = vigente indefinidamente</p>
                  }
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Notas</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  className="input-field resize-none"
                  placeholder="Ej: acuerdo verbal, contacto inicial Juan Rivera, pago mensual por transferencia, etc."
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 gap-3 border-t border-surface-700 px-6 py-4">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
              <button
                type="submit"
                disabled={saving || !form.site_id || !form.contact_id || !form.commission_pct || pctInvalid || dateInvalid}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar facilitador'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
