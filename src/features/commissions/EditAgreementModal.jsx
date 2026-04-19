import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const TYPE_OPTS = [
  { value: 'location_facilitator', label: 'Facilitador de locación',     helper: 'Te consiguió el acceso a la locación del cartel' },
  { value: 'management_contract',  label: 'Contrato de comercialización', helper: 'Es el dueño del cartel y te cede la venta'         },
]

export default function EditAgreementModal({ agreement, onClose, onSaved }) {
  const [form, setForm] = useState({
    title:           agreement.title           ?? '',
    commission_type: agreement.commission_type ?? 'location_facilitator',
    commission_pct:  agreement.commission_pct  ?? '',
    start_date:      agreement.start_date      ?? '',
    end_date:        agreement.end_date        ?? '',
    notes:           agreement.notes           ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const pctNum     = parseFloat(form.commission_pct)
  const pctInvalid = form.commission_pct !== '' && (isNaN(pctNum) || pctNum < 0 || pctNum > 100)
  const dateInvalid = form.end_date && form.start_date && form.end_date <= form.start_date

  async function handleSubmit(e) {
    e.preventDefault()
    if (pctInvalid || dateInvalid) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('facilitator_agreements')
      .update({
        title:           form.title.trim(),
        commission_type: form.commission_type,
        commission_pct:  parseFloat(form.commission_pct),
        start_date:      form.start_date,
        end_date:        form.end_date || null,
        notes:           form.notes.trim() || null,
      })
      .eq('id', agreement.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full md:max-w-2xl flex-col rounded-2xl border border-slate-700 bg-surface-800 shadow-2xl">

        <div className="flex shrink-0 items-center justify-between border-b border-surface-700 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Editar condiciones del acuerdo</h2>
            <p className="text-xs text-slate-500 mt-0.5">Código: {agreement.deal_code}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* Nombre */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Nombre del acuerdo *</label>
              <input
                type="text" required
                value={form.title}
                onChange={e => set('title', e.target.value)}
                className="input-field"
                placeholder='Ej: "Juan Rivera - Panamericana"'
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Tipo de acuerdo</label>
              <div className="space-y-2">
                {TYPE_OPTS.map(opt => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      form.commission_type === opt.value ? 'border-brand/60 bg-brand/10' : 'border-surface-700 hover:border-surface-600'
                    }`}
                  >
                    <input
                      type="radio" name="commission_type" value={opt.value}
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

            {/* % + fechas */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">% Comisión *</label>
                <div className="relative">
                  <input
                    type="number" min="0" max="100" step="0.5" required
                    value={form.commission_pct}
                    onChange={e => set('commission_pct', e.target.value)}
                    className={`input-field pr-7 ${pctInvalid ? 'border-red-500' : ''}`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                </div>
                {pctInvalid && <p className="mt-1 text-xs text-red-400">Debe estar entre 0 y 100</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Desde *</label>
                <input type="date" required value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Hasta <span className="text-slate-600">(opcional)</span></label>
                <input
                  type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                  className={`input-field ${dateInvalid ? 'border-red-500' : ''}`}
                />
                {dateInvalid
                  ? <p className="mt-1 text-xs text-red-400">Debe ser posterior a "Desde"</p>
                  : <p className="mt-1 text-xs text-slate-600">Vacío = indefinido</p>
                }
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Notas</label>
              <textarea
                rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
                className="input-field resize-none"
                placeholder="Condiciones especiales, contacto de referencia, forma de pago…"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <div className="flex shrink-0 gap-3 border-t border-surface-700 px-6 py-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button
              type="submit"
              disabled={saving || !form.title.trim() || !form.commission_pct || pctInvalid || dateInvalid}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
