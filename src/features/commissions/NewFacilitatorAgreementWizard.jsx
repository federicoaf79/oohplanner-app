import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const TYPE_OPTS = [
  { value: 'location_facilitator', label: 'Facilitador de locación',     helper: 'Te consiguió el acceso a la locación del cartel' },
  { value: 'management_contract',  label: 'Contrato de comercialización', helper: 'Es el dueño del cartel y te cede la venta'         },
]

const ROLE_BY_TYPE = {
  location_facilitator: 'facilitator',
  management_contract:  'landlord',
}

function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {[1, 2].map(n => (
        <div key={n} className="flex items-center gap-2">
          {n > 1 && <div className={`h-px w-8 ${step >= n ? 'bg-brand' : 'bg-surface-700'}`} />}
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
            step === n ? 'bg-brand text-white' : step > n ? 'bg-brand/30 text-brand' : 'bg-surface-700 text-slate-500'
          }`}>
            {n}
          </div>
          <span className={step === n ? 'text-slate-200' : 'text-slate-500'}>
            {n === 1 ? 'Contacto' : 'Condiciones'}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function NewFacilitatorAgreementWizard({ onClose, onSaved }) {
  const { org, profile } = useAuth()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState(false)

  // Paso 1
  const [title, setTitle]                       = useState('')
  const [contactMode, setContactMode]           = useState('new')
  const [existingContactId, setExistingContactId] = useState('')
  const [newContact, setNewContact]             = useState({ name: '', phone: '', email: '', tax_id: '' })
  const [visibility, setVisibility]             = useState('owner_only')
  const [existingContacts, setExistingContacts] = useState([])
  const [loadingContacts, setLoadingContacts]   = useState(true)

  // Paso 2
  const [commissionType, setCommissionType]     = useState('location_facilitator')
  const [commissionPct, setCommissionPct]       = useState('')
  const [startDate, setStartDate]               = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate]                   = useState('')
  const [notes, setNotes]                       = useState('')
  const [sitesMode, setSitesMode]               = useState('none')
  const [existingSiteIds, setExistingSiteIds]   = useState([])
  const [placeholderCount, setPlaceholderCount] = useState(1)
  const [existingSites, setExistingSites]       = useState([])
  const [loadingSites, setLoadingSites]         = useState(false)

  const setNC = (k, v) => setNewContact(f => ({ ...f, [k]: v }))

  // Load existing contacts on mount
  useEffect(() => {
    supabase.from('contacts')
      .select('id, name, legal_name, roles, visibility')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { setExistingContacts(data ?? []); setLoadingContacts(false) })
  }, [org.id])

  // Load sites when sitesMode switches to 'existing'
  useEffect(() => {
    if (sitesMode !== 'existing') return
    setLoadingSites(true)
    supabase.from('inventory')
      .select('id, name, code, address, is_complete')
      .eq('org_id', org.id)
      .order('name')
      .then(({ data }) => { setExistingSites(data ?? []); setLoadingSites(false) })
  }, [sitesMode, org.id])

  // Validation
  const step1Valid = title.trim() !== '' && (
    contactMode === 'existing'
      ? existingContactId !== ''
      : newContact.name.trim() !== ''
  )

  const pctNum      = parseFloat(commissionPct)
  const pctInvalid  = commissionPct !== '' && (isNaN(pctNum) || pctNum < 0 || pctNum > 100)
  const dateInvalid = endDate && startDate && endDate <= startDate
  const sitesValid  = sitesMode === 'none'     ? true
                    : sitesMode === 'existing' ? existingSiteIds.length > 0
                    : placeholderCount >= 1 && placeholderCount <= 20

  const step2Valid = commissionPct !== '' && !pctInvalid && startDate && !dateInvalid && sitesValid

  // Selected existing contact object (for visibility display)
  const selectedContact = existingContacts.find(c => c.id === existingContactId)

  function toggleSite(id) {
    setExistingSiteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      const dealCode = 'AC-' + String(Date.now()).slice(-6)

      // 1. Resolver contacto
      let contactId = existingContactId || null
      if (contactMode === 'new') {
        const { data: c, error: cErr } = await supabase
          .from('contacts').insert({
            org_id:     org.id,
            name:       newContact.name.trim(),
            phone:      newContact.phone.trim() || null,
            email:      newContact.email.trim() || null,
            tax_id:     newContact.tax_id.replace(/[-\s]/g, '') || null,
            roles:      [ROLE_BY_TYPE[commissionType]],
            visibility,
            is_active:  true,
            created_by: profile.id,
          }).select().single()
        if (cErr) throw cErr
        contactId = c.id
      } else {
        // Agregar rol relevante si no lo tiene
        const needed = ROLE_BY_TYPE[commissionType]
        if (selectedContact && !selectedContact.roles?.includes(needed)) {
          await supabase.from('contacts')
            .update({ roles: [...(selectedContact.roles ?? []), needed] })
            .eq('id', existingContactId)
        }
      }

      // 2. Crear facilitator_agreement
      const { data: agreement, error: aErr } = await supabase
        .from('facilitator_agreements').insert({
          org_id:          org.id,
          title:           title.trim(),
          contact_id:      contactId,
          commission_type: commissionType,
          commission_pct:  parseFloat(commissionPct),
          start_date:      startDate,
          end_date:        endDate || null,
          deal_code:       dealCode,
          notes:           notes.trim() || null,
          is_active:       true,
          created_by:      profile.id,
        }).select().single()
      if (aErr) throw aErr

      // 3. Resolver carteles
      let siteIds = []
      if (sitesMode === 'existing') {
        siteIds = existingSiteIds
      } else if (sitesMode === 'placeholders') {
        const rows = Array.from({ length: placeholderCount }, (_, i) => ({
          org_id:         org.id,
          name:           `${dealCode}-X${i + 1}`,
          code:           `${dealCode}-X${i + 1}`,
          agreement_code: dealCode,
          is_complete:    false,
          is_available:   true,
          created_by:     profile.id,
        }))
        const { data: newSites, error: sErr } = await supabase
          .from('inventory').insert(rows).select('id')
        if (sErr) throw sErr
        siteIds = newSites.map(s => s.id)
      }

      if (siteIds.length > 0) {
        const links = siteIds.map(siteId => ({
          org_id:       org.id,
          agreement_id: agreement.id,
          site_id:      siteId,
          created_by:   profile.id,
        }))
        const { error: lErr } = await supabase.from('site_commissions').insert(links)
        if (lErr) throw lErr
      }

      onSaved()
      onClose()
    } catch (err) {
      console.error(err)
      alert('Error al registrar el acuerdo: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Summary text for step 2
  const summaryLines = [
    `Nombre: ${title}`,
    `Tipo: ${commissionType === 'location_facilitator' ? 'Facilitador de locación' : 'Contrato de comercialización'}`,
    `Comisión: ${commissionPct}%`,
    `Vigencia: desde ${startDate}${endDate ? ` hasta ${endDate}` : ' (indefinida)'}`,
    sitesMode === 'none'         ? 'Carteles: acuerdo marco sin carteles (agregás después)'
    : sitesMode === 'existing'   ? `Carteles: ${existingSiteIds.length} existente${existingSiteIds.length !== 1 ? 's' : ''} seleccionado${existingSiteIds.length !== 1 ? 's' : ''}`
    : `Carteles: ${placeholderCount} placeholder${placeholderCount !== 1 ? 's' : ''} nuevos`,
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full md:max-w-3xl flex-col rounded-2xl border border-slate-700 bg-surface-800 shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-surface-700 px-6 py-4">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-white">Nuevo acuerdo con facilitador</h2>
            <StepIndicator step={step} />
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ═══ PASO 1 ═══ */}
          {step === 1 && (
            <>
              {/* Bloque 0 — Nombre del acuerdo */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">
                  Nombre del acuerdo *
                </label>
                <input
                  type="text"
                  className={`input-field w-full ${titleError ? 'border-red-500' : ''}`}
                  placeholder='Ej: "Juan Rivera - Panamericana", "Contrato GBA Norte", "Acuerdo Ruta 8"'
                  value={title}
                  onChange={e => { setTitle(e.target.value); if (e.target.value.trim()) setTitleError(false) }}
                />
                {titleError
                  ? <p className="mt-1 text-xs text-red-400">El nombre del acuerdo es requerido</p>
                  : <p className="mt-1 text-xs text-slate-500">Sirve para ubicar rápidamente el acuerdo en tu listado.</p>
                }
              </div>

              <hr className="border-surface-700" />

              <p className="text-sm font-medium text-slate-300">¿Con quién es el acuerdo?</p>

              {/* Bloque A — Contacto */}
              <div className="space-y-2">
                {[
                  { value: 'new',      label: 'Crear contacto nuevo',      helper: 'Datos mínimos — podés completar el resto desde Contactos después' },
                  { value: 'existing', label: 'Usar un contacto existente', helper: 'Seleccionar de los contactos activos del org' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      contactMode === opt.value ? 'border-brand/60 bg-brand/10' : 'border-surface-700 hover:border-surface-600'
                    }`}
                  >
                    <input
                      type="radio" name="contactMode" value={opt.value}
                      checked={contactMode === opt.value}
                      onChange={() => { setContactMode(opt.value); setExistingContactId('') }}
                      className="mt-0.5 accent-brand"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.helper}</p>
                    </div>
                  </label>
                ))}
              </div>

              {contactMode === 'new' && (
                <div className="space-y-3 rounded-lg border border-surface-700 p-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">Nombre / razón social *</label>
                    <input
                      type="text" required
                      value={newContact.name}
                      onChange={e => setNC('name', e.target.value)}
                      className="input-field"
                      placeholder="Nombre del facilitador o empresa"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-400">Teléfono</label>
                      <input type="tel" value={newContact.phone} onChange={e => setNC('phone', e.target.value)} className="input-field" placeholder="+54 11..." />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-400">Email</label>
                      <input type="email" value={newContact.email} onChange={e => setNC('email', e.target.value)} className="input-field" placeholder="correo@..." />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-400">CUIT</label>
                      <input type="text" value={newContact.tax_id} onChange={e => setNC('tax_id', e.target.value)} className="input-field" placeholder="20-..." />
                    </div>
                  </div>
                </div>
              )}

              {contactMode === 'existing' && (
                <div>
                  {loadingContacts ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando contactos…</div>
                  ) : (
                    <select
                      value={existingContactId}
                      onChange={e => setExistingContactId(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Seleccionar contacto…</option>
                      {existingContacts.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.legal_name ? ` — ${c.legal_name}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Bloque B — Visibilidad */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400">Visibilidad del contacto</p>

                {contactMode === 'existing' && selectedContact?.visibility ? (
                  <div className="rounded-lg border border-surface-700 px-4 py-3 text-xs text-slate-500">
                    Este contacto tiene visibilidad <strong className="text-slate-400">{selectedContact.visibility === 'owner_only' ? 'Solo el dueño' : 'Toda la empresa'}</strong>.
                    Cambialo desde el módulo de Contactos si necesitás ajustarlo.
                  </div>
                ) : (
                  <>
                    {[
                      { value: 'owner_only',   label: '🔒 Solo yo veo al contacto (confidencial)',
                        helper: 'El acuerdo y sus carteles siguen siendo visibles para gerentes, pero el contacto aparece como "Facilitador" sin identificar en cualquier lugar del sistema.' },
                      { value: 'company_wide', label: 'Toda la empresa ve al contacto',
                        helper: 'El contacto aparece en el listado de Contactos y cualquier miembro puede verlo.' },
                    ].map(opt => (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                          visibility === opt.value ? 'border-brand/60 bg-brand/10' : 'border-surface-700 hover:border-surface-600'
                        }`}
                      >
                        <input
                          type="radio" name="visibility" value={opt.value}
                          checked={visibility === opt.value}
                          onChange={() => setVisibility(opt.value)}
                          className="mt-0.5 accent-brand"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-200">{opt.label}</p>
                          {opt.helper && <p className="text-xs text-slate-500">{opt.helper}</p>}
                        </div>
                      </label>
                    ))}
                  </>
                )}
              </div>
            </>
          )}

          {/* ═══ PASO 2 ═══ */}
          {step === 2 && (
            <>
              <p className="text-sm font-medium text-slate-300">Condiciones del acuerdo</p>

              {/* Bloque A — Tipo */}
              <div className="space-y-2">
                {TYPE_OPTS.map(opt => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      commissionType === opt.value ? 'border-brand/60 bg-brand/10' : 'border-surface-700 hover:border-surface-600'
                    }`}
                  >
                    <input
                      type="radio" name="commissionType" value={opt.value}
                      checked={commissionType === opt.value}
                      onChange={() => setCommissionType(opt.value)}
                      className="mt-0.5 accent-brand"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.helper}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Bloque B — % + fechas */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">% Comisión *</label>
                  <div className="relative">
                    <input
                      type="number" min="0" max="100" step="0.5" required
                      value={commissionPct}
                      onChange={e => setCommissionPct(e.target.value)}
                      className={`input-field pr-7 ${pctInvalid ? 'border-red-500' : ''}`}
                      placeholder="0.00"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                  </div>
                  {pctInvalid && <p className="mt-1 text-xs text-red-400">Debe estar entre 0 y 100</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Vigente desde *</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Vigente hasta <span className="text-slate-600">(opcional)</span></label>
                  <input
                    type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className={`input-field ${dateInvalid ? 'border-red-500' : ''}`}
                  />
                  {dateInvalid
                    ? <p className="mt-1 text-xs text-red-400">Debe ser posterior a "Desde"</p>
                    : <p className="mt-1 text-xs text-slate-600">Vacío = indefinido</p>
                  }
                </div>
              </div>

              {/* Bloque C — Notas */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Notas</label>
                <textarea
                  rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                  className="input-field resize-none"
                  placeholder="Ej: acuerdo verbal, contacto inicial Juan Pérez, pago mensual por transferencia…"
                />
              </div>

              {/* Bloque D — Carteles */}
              <div>
                <p className="mb-2 text-xs font-medium text-slate-400">Carteles asociados</p>
                <div className="space-y-2">
                  {[
                    { value: 'none',         label: 'Ninguno todavía (acuerdo marco)',
                      helper: 'Registrar el acuerdo sin carteles. Podés asociar carteles después desde el detalle del acuerdo.' },
                    { value: 'existing',     label: 'Cartel(es) existente(s)',
                      helper: 'Vincular carteles ya cargados en el inventario' },
                    { value: 'placeholders', label: 'N carteles placeholder',
                      helper: 'El sistema crea carteles sin datos para que el equipo los complete después' },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        sitesMode === opt.value ? 'border-brand/60 bg-brand/10' : 'border-surface-700 hover:border-surface-600'
                      }`}
                    >
                      <input
                        type="radio" name="sitesMode" value={opt.value}
                        checked={sitesMode === opt.value}
                        onChange={() => { setSitesMode(opt.value); setExistingSiteIds([]) }}
                        className="mt-0.5 accent-brand"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-200">{opt.label}</p>
                        <p className="text-xs text-slate-500">{opt.helper}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {sitesMode === 'existing' && (
                  <div className="mt-3">
                    {loadingSites ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
                    ) : existingSites.length === 0 ? (
                      <p className="text-sm text-slate-500">No hay carteles en el inventario.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-surface-700 divide-y divide-surface-700">
                        {existingSites.map(site => (
                          <label key={site.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-800/60 transition-colors">
                            <input type="checkbox" checked={existingSiteIds.includes(site.id)} onChange={() => toggleSite(site.id)} className="accent-brand" />
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
                    )}
                  </div>
                )}

                {sitesMode === 'placeholders' && (
                  <div className="mt-3 flex items-end gap-4">
                    <div className="w-36">
                      <label className="mb-1.5 block text-xs font-medium text-slate-400">Cantidad *</label>
                      <input
                        type="number" min="1" max="20"
                        value={placeholderCount}
                        onChange={e => setPlaceholderCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="input-field"
                      />
                    </div>
                    <p className="text-xs text-slate-500 pb-2">Se crearán con el código del acuerdo + X1, X2…</p>
                  </div>
                )}
              </div>

              {/* Bloque E — Resumen */}
              <div className="rounded-lg border border-brand/20 bg-brand/5 px-4 py-3">
                <p className="mb-2 text-xs font-semibold text-brand">Resumen del acuerdo</p>
                <ul className="space-y-1">
                  {summaryLines.map((line, i) => (
                    <li key={i} className="text-xs text-slate-400">· {line}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-3 border-t border-surface-700 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          {step === 1 && (
            <button
              type="button"
              onClick={() => {
                if (!title.trim()) { setTitleError(true); return }
                setStep(2)
              }}
              className="btn-primary flex-1"
            >
              Siguiente →
            </button>
          )}
          {step === 2 && (
            <>
              <button type="button" onClick={() => setStep(1)} className="btn-secondary px-4">← Atrás</button>
              <button
                type="button"
                disabled={saving || !step2Valid}
                onClick={handleSubmit}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {saving ? <><Loader2 className="h-4 w-4 animate-spin inline mr-1.5" />Guardando…</> : 'Crear acuerdo'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
