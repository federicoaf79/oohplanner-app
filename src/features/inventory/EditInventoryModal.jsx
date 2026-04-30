import { useState, useEffect, useRef } from 'react'
import { X, Upload, Save, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { FORMAT_MAP } from '../../lib/constants'

// ── Helpers ───────────────────────────────────────────────────

function Label({ children }) {
  return <label className="mb-1.5 block text-sm font-medium text-slate-300">{children}</label>
}

function FieldRow({ label, children }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function NumericField({ label, value, onChange, prefix, suffix, step = 'any' }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{prefix}</span>}
        <input
          type="number"
          step={step}
          className={`input-field ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-10' : ''}`}
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{suffix}</span>}
      </div>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────

const TABS = [
  { id: 'basic',      label: 'Datos básicos' },
  { id: 'campaign',   label: 'Costos campaña' },
  { id: 'financiero', label: 'Financiero' },
]

// ── Main modal ────────────────────────────────────────────────

export default function EditInventoryModal({ item, onClose, onSaved }) {
  const { profile, isOwner, isManager } = useAuth()
  const [tab, setTab]     = useState('basic')
  const [form, setForm]   = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formats, setFormats]     = useState([])
  const fileRef = useRef(null)

  const [landlordContacts, setLandlordContacts] = useState([])

  useEffect(() => {
    if (!item) return
    // Cargar contactos con rol landlord para selector
    supabase
      .from('contacts')
      .select('id, name, company')
      .eq('org_id', item.org_id)
      .contains('roles', ['landlord'])
      .order('name')
      .then(({ data }) => setLandlordContacts(data ?? []))

    setForm({
      name:          item.name ?? '',
      address:       item.address ?? '',
      city:          item.city ?? '',
      format:        item.format ?? '',
      format_id:     item.format_id ?? null,
      width_ft:      item.width_ft ?? '',
      height_ft:     item.height_ft ?? '',
      owner_type:    item.owner_type ?? 'owned',
      illuminated:   item.illuminated ?? false,
      is_available:  item.is_available ?? true,
      latitude:      item.latitude ?? '',
      longitude:     item.longitude ?? '',
      photo_url:     item.photo_url ?? '',
      // Banda negativa
      banda_negativa:          item.banda_negativa_enabled ?? false,
      banda_negativa_rate:     item.banda_negativa_rate ?? 0,
      banda_negativa_min_months: item.banda_negativa_min_months ?? 1,
      // Costos fijos
      cost_rent:                item.cost_rent ?? 0,
      cost_electricity:         item.cost_electricity ?? 0,
      cost_taxes:               item.cost_taxes ?? 0,
      cost_maintenance:         item.cost_maintenance ?? 0,
      cost_imponderables:       item.cost_imponderables ?? 0,
      cost_owner_commission:    item.cost_owner_commission ?? 0,
      // Asociado al cartel
      asociado_nombre:          item.asociado_nombre ?? '',
      cost_owner_commission_pct:    item.cost_owner_commission_pct ?? 0,
      // Costos campaña
      cost_print_per_m2:        item.cost_print_per_m2 ?? 0,
      cost_colocation:        item.cost_colocation ?? 0,
      cost_design:              item.cost_design ?? 0,
      cost_agency_commission_pct: item.cost_agency_commission_pct ?? 0,
      // Medidas de impresión
      print_width_cm:           item.print_width_cm ?? null,
      print_height_cm:          item.print_height_cm ?? null,
      // CAPEX
      capex_total:              item.capex_total ?? 0,
      capex_amortization_months: item.capex_amortization_months ?? 60,
      // Landlord (para owner_type='rented')
      landlord_contact_id:      item.landlord_contact_id ?? null,
      // Permisos
      permit_number:            item.permit_number ?? '',
      permit_expiry:            item.permit_expiry ?? '',
    })

    // Load formats from DB (global + org-specific)
    supabase
      .from('formats')
      .select('id, name, type')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setFormats(data ?? []))
  }, [item])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await new Promise((resolve) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(url)
          const canvas = document.createElement('canvas')
          let { width, height } = img
          if (width > 1920) { height = Math.round(height * 1920 / width); width = 1920 }
          canvas.width = width
          canvas.height = height
          canvas.getContext('2d').drawImage(img, 0, 0, width, height)
          const tryCompress = (q) => {
            canvas.toBlob((b) => {
              if (b.size > 700_000 && q > 0.3) tryCompress(q - 0.1)
              else resolve(b)
            }, 'image/jpeg', q)
          }
          tryCompress(0.85)
        }
        img.src = url
      })

      const path = `${form.org_id || item.org_id}/${item.id}_A.jpg`
      const { error } = await supabase.storage
        .from('inventory-photos')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('inventory-photos')
        .getPublicUrl(path)

      // caras puede llegar como string JSON desde Supabase
      const carasRaw = item.caras
      const carasArr = Array.isArray(carasRaw)
        ? carasRaw
        : (typeof carasRaw === 'string' ? JSON.parse(carasRaw) : [])

      const caras = carasArr.length > 0
        ? carasArr.map((c, i) => i === 0 ? { ...c, photo_url: publicUrl } : c)
        : [{ id: 'A', label: 'Cara A', photo_url: publicUrl, billboard_zone: null }]

      set('photo_url', publicUrl)
      set('caras', caras)
    } catch (err) {
      console.error('Error subiendo foto:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    if (!item || !form) return
    setSaving(true)
    const { error } = await supabase
      .from('inventory')
      .update({
        name:          form.name,
        address:       form.address,
        city:          form.city,
        format:        form.format,
        format_id:     form.format_id || null,
        width_ft:      form.width_ft ? Number(form.width_ft) : null,
        height_ft:     form.height_ft ? Number(form.height_ft) : null,
        owner_type:    form.owner_type,
        illuminated:   form.illuminated,
        is_available:  form.is_available,
        latitude:      form.latitude ? Number(form.latitude) : null,
        longitude:     form.longitude ? Number(form.longitude) : null,
        photo_url:     form.photo_url || null,
        caras:         form.caras ?? item.caras ?? null,
        banda_negativa_enabled: form.banda_negativa,
        banda_negativa_rate:      form.banda_negativa_rate,
        banda_negativa_min_months: form.banda_negativa_min_months,
        cost_rent:                form.cost_rent,
        cost_electricity:         form.cost_electricity,
        cost_taxes:               form.cost_taxes,
        cost_maintenance:         form.cost_maintenance,
        cost_imponderables:       form.cost_imponderables,
        cost_owner_commission:    form.cost_owner_commission,
        asociado_nombre:          form.asociado_nombre || null,
        cost_owner_commission_pct:    form.cost_owner_commission_pct,
        cost_print_per_m2:        form.cost_print_per_m2,
        cost_colocation:        form.cost_colocation,
        cost_design:              form.cost_design,
        cost_agency_commission_pct: form.cost_agency_commission_pct,
        print_width_cm:           form.print_width_cm ? Number(form.print_width_cm) : null,
        print_height_cm:          form.print_height_cm ? Number(form.print_height_cm) : null,
        // CAPEX
        capex_total:              Number(form.capex_total) || 0,
        capex_amortization_months: Number(form.capex_amortization_months) || 60,
        // Landlord
        landlord_contact_id:      form.landlord_contact_id || null,
        // Permisos
        permit_number:            form.permit_number || null,
        permit_expiry:            form.permit_expiry || null,
      })
      .eq('id', item.id)

    setSaving(false)
    if (!error) onSaved()
  }

  if (!form) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex h-[90vh] w-full md:max-w-4xl xl:max-w-5xl flex-col rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-700 px-5 py-4">
          <div>
            <p className="font-semibold text-white">Editar cartel</p>
            <p className="text-xs text-slate-500">{item.name}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-700 transition-colors">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-700 px-5">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-slate-500 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── TAB 1: Datos básicos ── */}
          {tab === 'basic' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ── Col izquierda ── */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Nombre *">
                    <input className="input-field" value={form.name} onChange={e => set('name', e.target.value)} />
                  </FieldRow>
                  <FieldRow label="Ciudad">
                    <input className="input-field" value={form.city} onChange={e => set('city', e.target.value)} />
                  </FieldRow>
                </div>

                <FieldRow label="Dirección">
                  <input className="input-field" value={form.address} onChange={e => set('address', e.target.value)} />
                </FieldRow>

                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Formato">
                    {formats.length > 0 ? (
                      <select className="input-field appearance-none"
                        value={form.format_id ?? ''}
                        onChange={e => {
                          const f = formats.find(x => x.id === e.target.value)
                          set('format_id', e.target.value || null)
                          if (f) set('format', f.type)
                        }}>
                        <option value="">Seleccioná un formato</option>
                        {formats.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    ) : (
                      <select className="input-field appearance-none"
                        value={form.format}
                        onChange={e => set('format', e.target.value)}>
                        {Object.entries(FORMAT_MAP).map(([id, { label }]) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </select>
                    )}
                  </FieldRow>
                  <FieldRow label="Tipo de propiedad">
                    <select className="input-field appearance-none" value={form.owner_type} onChange={e => set('owner_type', e.target.value)}>
                      <option value="owned">Propio</option>
                      <option value="rented">Alquilado</option>
                    </select>
                  </FieldRow>
                </div>

                {/* Landlord — solo para alquilados */}
                {form.owner_type === 'rented' && (
                  <FieldRow label="Propietario / Landlord *">
                    <select
                      className="input-field appearance-none"
                      value={form.landlord_contact_id ?? ''}
                      onChange={e => set('landlord_contact_id', e.target.value || null)}
                    >
                      <option value="">— Seleccioná el propietario —</option>
                      {landlordContacts.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.company ? ` · ${c.company}` : ''}
                        </option>
                      ))}
                      {landlordContacts.length === 0 && (
                        <option disabled>Sin contactos con rol Propietario — agregar en Contactos</option>
                      )}
                    </select>
                  </FieldRow>
                )}

                {/* Permisos */}
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="N° de permiso">
                    <input className="input-field" value={form.permit_number} onChange={e => set('permit_number', e.target.value)} placeholder="Ej: EXP-2024-1234" />
                  </FieldRow>
                  <FieldRow label="Vencimiento permiso">
                    <input className="input-field" type="date" value={form.permit_expiry} onChange={e => set('permit_expiry', e.target.value)} />
                  </FieldRow>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <NumericField label="Ancho (m)" value={form.width_ft} onChange={v => set('width_ft', v)} step="0.1" />
                  <NumericField label="Alto (m)" value={form.height_ft} onChange={v => set('height_ft', v)} step="0.1" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Latitud</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input className="input-field pl-9" type="number" step="0.000001" value={form.latitude} onChange={e => set('latitude', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Longitud</Label>
                    <input className="input-field" type="number" step="0.000001" value={form.longitude} onChange={e => set('longitude', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* ── Col derecha — Foto, medidas, toggles ── */}
              <div className="space-y-4">
                <div>
                  <Label>Foto del cartel</Label>
                  {form.photo_url ? (
                    <div className="relative inline-block">
                      <img src={form.photo_url} alt="Foto" className="h-32 w-auto rounded-xl object-cover border border-surface-700" />
                      <button type="button" onClick={() => set('photo_url', '')}
                        className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-700 py-6 text-sm text-slate-500 hover:border-brand/50 hover:text-slate-300 transition-colors">
                      <Upload className="h-4 w-4" />
                      {uploading ? 'Subiendo...' : 'Subir foto (sin anuncio)'}
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-3">Medidas de impresión (tela/afiche)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <NumericField label="Ancho impresión (cm)" value={form.print_width_cm} onChange={v => set('print_width_cm', v)} step="0.1" />
                    <NumericField label="Alto impresión (cm)" value={form.print_height_cm} onChange={v => set('print_height_cm', v)} step="0.1" />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Opciones</p>
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { field: 'illuminated',  label: 'Iluminado' },
                      { field: 'is_available', label: 'Disponible' },
                      { field: 'banda_negativa', label: 'Banda negativa' },
                    ].map(({ field, label }) => (
                      <button key={field} type="button"
                        onClick={() => set(field, !form[field])}
                        className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                          form[field]
                            ? 'border-brand bg-brand/10 text-brand'
                            : 'border-surface-700 text-slate-400 hover:border-slate-500'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.banda_negativa && (
                  <div className="grid grid-cols-2 gap-4 rounded-xl border border-surface-700 p-4">
                    <NumericField label="Tarifa banda negativa (ARS/mes)" value={form.banda_negativa_rate} onChange={v => set('banda_negativa_rate', v)} prefix="$" />
                    <NumericField label="Meses mínimos" value={form.banda_negativa_min_months} onChange={v => set('banda_negativa_min_months', v)} step="1" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 2: Costos campaña ── */}
          {tab === 'campaign' && (
            <div className="space-y-5">
              <p className="text-xs text-slate-500">
                Costos variables por campaña. Se aplican cada vez que el cartel es incluido en una propuesta.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumericField label="Impresión de lona (por m²)" value={form.cost_print_per_m2} onChange={v => set('cost_print_per_m2', v)} prefix="$" />
                <NumericField label="Colocación de lona" value={form.cost_colocation} onChange={v => set('cost_colocation', v)} prefix="$" />
                <NumericField label="Diseño gráfico" value={form.cost_design} onChange={v => set('cost_design', v)} prefix="$" />
                <NumericField label="Comisión agencia" value={form.cost_agency_commission_pct} onChange={v => set('cost_agency_commission_pct', v)} suffix="%" />
              </div>
            </div>
          )}

          {/* ── TAB 3: Financiero (OPEX + CAPEX) ── */}
          {tab === 'financiero' && (
            <div className="space-y-6">

              {/* OPEX */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-300">OPEX mensual</p>
                  <span className="text-xs text-slate-500">— costos recurrentes del espacio</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumericField label="Alquiler / canon del espacio" value={form.cost_rent} onChange={v => set('cost_rent', v)} prefix="$" />
                  <NumericField label="Luz / energía" value={form.cost_electricity} onChange={v => set('cost_electricity', v)} prefix="$" />
                  <NumericField label="Impuestos y derechos" value={form.cost_taxes} onChange={v => set('cost_taxes', v)} prefix="$" />
                  <NumericField label="Mantenimiento estimado" value={form.cost_maintenance} onChange={v => set('cost_maintenance', v)} prefix="$" />
                  <NumericField label="Imponderables" value={form.cost_imponderables} onChange={v => set('cost_imponderables', v)} prefix="$" />
                </div>
              </div>

              {/* Separador */}
              <div className="border-t border-surface-700" />

              {/* CAPEX */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-300">CAPEX</p>
                  <span className="text-xs text-slate-500">— inversión inicial en estructura física</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumericField label="Inversión total CAPEX (ARS)" value={form.capex_total} onChange={v => set('capex_total', v)} prefix="$" />
                  <NumericField label="Meses de amortización" value={form.capex_amortization_months} onChange={v => set('capex_amortization_months', Math.max(1, Number(v)))} step="1" />
                </div>
                <p className="text-xs text-slate-600">Incluye: estructura metálica, tensores, iluminación, obra civil. No incluir costos recurrentes.</p>
              </div>

              {/* Separador */}
              <div className="border-t border-surface-700" />

              {/* Resumen financiero unificado */}
              <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Resumen financiero mensual</p>

                {/* OPEX breakdown */}
                {[
                  ['Alquiler/canon', form.cost_rent],
                  ['Luz/energía',    form.cost_electricity],
                  ['Impuestos',      form.cost_taxes],
                  ['Mantenimiento',  form.cost_maintenance],
                  ['Imponderables',  form.cost_imponderables],
                ].filter(([, v]) => Number(v) > 0).map(([label, value]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-slate-500">{label}</span>
                    <span className="text-slate-300">${Number(value).toLocaleString('es-AR')}</span>
                  </div>
                ))}

                {/* Total OPEX */}
                {(() => {
                  const opex = (form.cost_rent||0)+(form.cost_electricity||0)+(form.cost_taxes||0)+(form.cost_maintenance||0)+(form.cost_imponderables||0)
                  return opex > 0 ? (
                    <div className="flex justify-between text-sm border-t border-surface-700 pt-2">
                      <span className="text-slate-400 font-medium">Total OPEX/mes</span>
                      <span className="font-semibold text-white">${opex.toLocaleString('es-AR')}</span>
                    </div>
                  ) : null
                })()}

                {/* CAPEX amortizado */}
                {form.capex_total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 font-medium">
                      CAPEX amort. ({form.capex_amortization_months} meses)
                    </span>
                    <span className="font-semibold text-amber-400">
                      ${Math.round(form.capex_total / Math.max(1, form.capex_amortization_months)).toLocaleString('es-AR')}/mes
                    </span>
                  </div>
                )}

                {/* Margen neto */}
                {item.base_rate > 0 && (() => {
                  const opex = (form.cost_rent||0)+(form.cost_electricity||0)+(form.cost_taxes||0)+(form.cost_maintenance||0)+(form.cost_imponderables||0)
                  const capexMensual = form.capex_total > 0 ? Math.round(form.capex_total / Math.max(1, form.capex_amortization_months)) : 0
                  const margen = item.base_rate - opex - capexMensual
                  return (
                    <div className="flex justify-between text-sm border-t border-surface-700 pt-2 mt-1">
                      <span className="text-slate-300 font-semibold">Margen neto estimado</span>
                      <span className={`font-bold text-base ${margen >= 0 ? 'text-brand' : 'text-red-400'}`}>
                        ${margen.toLocaleString('es-AR')}/mes
                      </span>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-surface-700 px-5 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-surface-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Cancelar
          </button>
          <Button loading={saving} onClick={handleSave}>
            <Save className="h-4 w-4" />
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}
