import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function AddSitesToAgreementModal({ agreement, onClose, onSaved }) {
  const { org, profile } = useAuth()

  const [mode, setMode]           = useState('existing')
  const [allSites, setAllSites]   = useState([])  // sites not yet linked
  const [selected, setSelected]   = useState([])   // ids chosen in 'existing' mode
  const [count, setCount]         = useState(1)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [existingCount, setExistingCount] = useState(0) // placeholders already in this deal

  useEffect(() => {
    async function load() {
      // Sites linked to this agreement already
      const { data: linked } = await supabase
        .from('site_commissions')
        .select('site_id')
        .eq('agreement_id', agreement.id)
      const linkedIds = new Set((linked ?? []).map(r => r.site_id))

      // All sites in org, excluding already linked
      const { data: sites } = await supabase
        .from('inventory')
        .select('id, name, code, address, is_complete')
        .eq('org_id', org.id)
        .order('name')
      setAllSites((sites ?? []).filter(s => !linkedIds.has(s.id)))

      // Count existing placeholders for this deal_code (for naming new ones)
      const { count: c } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org.id)
        .eq('agreement_code', agreement.deal_code)
      setExistingCount(c ?? 0)

      setLoading(false)
    }
    load()
  }, [agreement.id, agreement.deal_code, org.id])

  function toggleSite(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let siteIds = []

      if (mode === 'existing') {
        siteIds = selected
      } else {
        const rows = Array.from({ length: count }, (_, i) => ({
          org_id:         org.id,
          name:           `${agreement.deal_code}-X${existingCount + i + 1}`,
          code:           `${agreement.deal_code}-X${existingCount + i + 1}`,
          agreement_code: agreement.deal_code,
          is_complete:    false,
          is_available:   true,
          created_by:     profile.id,
        }))
        const { data: newSites, error: sErr } = await supabase
          .from('inventory').insert(rows).select('id')
        if (sErr) throw sErr
        siteIds = newSites.map(s => s.id)
      }

      if (siteIds.length === 0) throw new Error('Seleccioná al menos un cartel')

      const links = siteIds.map(siteId => ({
        org_id:       org.id,
        agreement_id: agreement.id,
        site_id:      siteId,
        created_by:   profile.id,
      }))
      const { error: lErr } = await supabase.from('site_commissions').insert(links)
      if (lErr) throw lErr

      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = mode === 'existing'
    ? selected.length > 0
    : count >= 1 && count <= 20

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full md:max-w-2xl flex-col rounded-2xl border border-slate-700 bg-surface-800 shadow-2xl">

        <div className="flex shrink-0 items-center justify-between border-b border-surface-700 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Agregar carteles a "{agreement.title}"</h2>
            <p className="text-xs text-slate-500 mt-0.5">Código: {agreement.deal_code}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              {/* Mode selector */}
              <div className="space-y-2">
                {[
                  { value: 'existing',     label: 'Cartel(es) existente(s)', helper: 'Vincular carteles ya cargados en inventario' },
                  { value: 'placeholders', label: 'Carteles placeholder nuevos', helper: `Se crearán con códigos ${agreement.deal_code}-X${existingCount + 1}, X${existingCount + 2}… para completar después` },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      mode === opt.value ? 'border-brand/60 bg-brand/10' : 'border-surface-700 hover:border-surface-600'
                    }`}
                  >
                    <input
                      type="radio" name="mode" value={opt.value}
                      checked={mode === opt.value}
                      onChange={() => { setMode(opt.value); setSelected([]); setError(null) }}
                      className="mt-0.5 accent-brand"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.helper}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Existing sites multi-select */}
              {mode === 'existing' && (
                allSites.length === 0 ? (
                  <p className="rounded-lg border border-surface-700 px-4 py-6 text-center text-sm text-slate-500">
                    Todos los carteles ya están vinculados a este acuerdo, o no hay carteles en el inventario.
                  </p>
                ) : (
                  <div className="rounded-lg border border-surface-700 divide-y divide-surface-700 overflow-hidden">
                    {allSites.map(site => (
                      <label key={site.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-800/60 transition-colors">
                        <input
                          type="checkbox"
                          checked={selected.includes(site.id)}
                          onChange={() => toggleSite(site.id)}
                          className="accent-brand"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-200 truncate">{site.name}</p>
                          {site.address && <p className="text-xs text-slate-500 truncate">{site.address}</p>}
                        </div>
                        {!site.is_complete && (
                          <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">placeholder</span>
                        )}
                      </label>
                    ))}
                  </div>
                )
              )}

              {/* Placeholder count */}
              {mode === 'placeholders' && (
                <div className="w-40">
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Cantidad de carteles *</label>
                  <input
                    type="number" min="1" max="20" required
                    value={count}
                    onChange={e => setCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="input-field"
                  />
                  <p className="mt-1 text-xs text-slate-600">Máximo 20 a la vez</p>
                </div>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            <div className="flex shrink-0 gap-3 border-t border-surface-700 px-6 py-4">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={saving || !canSubmit} className="btn-primary flex-1 disabled:opacity-50">
                {saving ? 'Guardando…' : `Agregar ${mode === 'placeholders' ? count + ' placeholder' + (count > 1 ? 's' : '') : selected.length > 0 ? selected.length + ' cartel' + (selected.length > 1 ? 'es' : '') : 'carteles'}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
