import { useState, useMemo } from 'react'
import { X, ChevronDown, ChevronRight, AlertTriangle, Search, Lock } from 'lucide-react'
import { ROLES_BY_CATEGORY, CONTACT_ROLE_CATEGORIES } from '../../lib/contactRoles'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const CAT_COLOR = Object.fromEntries(CONTACT_ROLE_CATEGORIES.map(c => [c.id, c.color]))

const TAX_ID_ROLES = ['landlord', 'tax_authority', 'municipality', 'provincial_authority', 'national_authority', 'property_manager', 'building_manager']

function validateCUIT(val) {
  if (!val) return true
  return /^\d{11}$/.test(val.replace(/[-\s]/g, ''))
}

function Section({ title, open, onToggle, children }) {
  return (
    <div className="rounded-lg border border-surface-700 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-surface-700 transition-colors"
      >
        {title}
        {open
          ? <ChevronDown className="h-4 w-4 text-slate-400" />
          : <ChevronRight className="h-4 w-4 text-slate-400" />
        }
      </button>
      {open && <div className="space-y-3 px-4 pb-4 pt-2">{children}</div>}
    </div>
  )
}

const EMPTY = {
  name: '',
  legal_name: '',
  tax_id: '',
  roles: [],
  is_active: true,
  visibility: 'org',
  email: '',
  phone: '',
  whatsapp: '',
  website: '',
  contact_person_name: '',
  contact_person_role: '',
  address: '',
  city: '',
  province: '',
  country: 'Argentina',
  notes: '',
}

export default function ContactFormModal({ contact, onClose, onSaved }) {
  const { profile, isOwner } = useAuth()
  const isEdit = !!contact?.id

  const [form, setForm] = useState(() => isEdit ? {
    name:                contact.name                ?? '',
    legal_name:          contact.legal_name          ?? '',
    tax_id:              contact.tax_id              ?? '',
    roles:               contact.roles               ?? [],
    is_active:           contact.is_active           ?? true,
    visibility:          contact.visibility          ?? 'org',
    email:               contact.email               ?? '',
    phone:               contact.phone               ?? '',
    whatsapp:            contact.whatsapp            ?? '',
    website:             contact.website             ?? '',
    contact_person_name: contact.contact_person_name ?? '',
    contact_person_role: contact.contact_person_role ?? '',
    address:             contact.address             ?? '',
    city:                contact.city                ?? '',
    province:            contact.province            ?? '',
    country:             contact.country             ?? 'Argentina',
    notes:               contact.notes               ?? '',
  } : { ...EMPTY })
  const [open, setOpen] = useState({ basics: true, visibility: true, contact: true, person: false, address: false, notes: false })
  const [roleSearch, setRoleSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggle = k => setOpen(s => ({ ...s, [k]: !s[k] }))

  function toggleRole(roleId) {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(roleId)
        ? f.roles.filter(r => r !== roleId)
        : [...f.roles, roleId],
    }))
  }

  const cuitInvalid = form.tax_id.trim() !== '' && !validateCUIT(form.tax_id)
  const suggestTaxId = !form.tax_id.trim() && form.roles.some(r => TAX_ID_ROLES.includes(r))

  const visibleCategories = useMemo(() => {
    if (!roleSearch.trim()) return ROLES_BY_CATEGORY
    const q = roleSearch.toLowerCase()
    return ROLES_BY_CATEGORY
      .map(cat => ({ ...cat, roles: cat.roles.filter(r => r.label.toLowerCase().includes(q)) }))
      .filter(cat => cat.roles.length > 0)
  }, [roleSearch])

  async function handleSubmit(e) {
    e.preventDefault()
    if (cuitInvalid) return
    setSaving(true)
    setError(null)

    const payload = {
      org_id:               profile.org_id,
      name:                 (form.name                ?? '').trim(),
      legal_name:           (form.legal_name          ?? '').trim() || null,
      tax_id:               (form.tax_id              ?? '').replace(/[-\s]/g, '') || null,
      roles:                form.roles,
      is_active:            form.is_active,
      visibility:           isOwner ? (form.visibility ?? 'org') : undefined,
      email:                (form.email               ?? '').trim() || null,
      phone:                (form.phone               ?? '').trim() || null,
      whatsapp:             (form.whatsapp            ?? '').trim() || null,
      website:              (form.website             ?? '').trim() || null,
      contact_person_name:  (form.contact_person_name ?? '').trim() || null,
      contact_person_role:  (form.contact_person_role ?? '').trim() || null,
      address:              (form.address             ?? '').trim() || null,
      city:                 (form.city                ?? '').trim() || null,
      province:             (form.province            ?? '').trim() || null,
      country:              (form.country             ?? '').trim() || null,
      notes:                (form.notes               ?? '').trim() || null,
    }

    const result = isEdit
      ? await supabase.from('contacts').update(payload).eq('id', contact.id).select().single()
      : await supabase.from('contacts').insert(payload).select().single()

    setSaving(false)
    if (result.error) { setError(result.error.message); return }
    onSaved(result.data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full md:max-w-5xl flex-col rounded-2xl border border-slate-700 bg-surface-800 shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-surface-700 px-6 py-4">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? 'Editar contacto' : 'Nuevo contacto'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8">

              {/* ── COLUMNA IZQUIERDA ── */}
              <div className="space-y-3">

                {/* 1 — Datos básicos */}
                <Section title="Datos básicos" open={open.basics} onToggle={() => toggle('basics')}>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">Nombre de fantasía o referencia rápida *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                      required
                      className="input-field"
                      placeholder="Cómo lo identificás en el día a día"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">Razón social (si es empresa)</label>
                    <input
                      type="text"
                      value={form.legal_name}
                      onChange={e => set('legal_name', e.target.value)}
                      className="input-field"
                      placeholder="Ej: La Suipachense S.A."
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">
                      CUIT / CUIL
                      {suggestTaxId && (
                        <span className="ml-2 inline-flex items-center gap-1 text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> Recomendado para este rol
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={form.tax_id}
                      onChange={e => set('tax_id', e.target.value)}
                      className={`input-field ${cuitInvalid ? 'border-red-500' : ''}`}
                      placeholder="20-12345678-9"
                    />
                    {cuitInvalid && (
                      <p className="mt-1 text-xs text-red-400">CUIT inválido (debe tener 11 dígitos)</p>
                    )}
                  </div>
                </Section>

                {/* 2 — Visibilidad del contacto (solo owner) */}
                {isOwner && (
                  <Section title="Visibilidad del contacto" open={open.visibility} onToggle={() => toggle('visibility')}>
                    <div className="space-y-2">
                      <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        form.visibility === 'org'
                          ? 'border-brand/60 bg-brand/5'
                          : 'border-surface-600 hover:border-surface-500'
                      }`}>
                        <input
                          type="radio" name="visibility" value="org"
                          checked={form.visibility === 'org'}
                          onChange={() => set('visibility', 'org')}
                          className="mt-0.5 accent-brand"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-100">Toda la empresa lo ve</p>
                          <p className="text-xs text-slate-500 mt-0.5">Cualquier miembro del equipo puede ver este contacto.</p>
                        </div>
                      </label>
                      <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        form.visibility === 'owner_only'
                          ? 'border-amber-500/50 bg-amber-500/5'
                          : 'border-surface-600 hover:border-surface-500'
                      }`}>
                        <input
                          type="radio" name="visibility" value="owner_only"
                          checked={form.visibility === 'owner_only'}
                          onChange={() => set('visibility', 'owner_only')}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-amber-400" />
                            <p className="text-sm font-medium text-slate-100">Solo yo lo veo (confidencial)</p>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            No aparecerá para el resto del equipo. En reportes figurará como "Facilitador" sin identificar.
                          </p>
                        </div>
                      </label>
                    </div>
                  </Section>
                )}

                {/* 3 — Datos de contacto */}
                <Section title="Datos de contacto" open={open.contact} onToggle={() => toggle('contact')}>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">Email</label>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input-field" placeholder="correo@ejemplo.com" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">Teléfono</label>
                    <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className="input-field" placeholder="+54 9 11 1234-5678" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">WhatsApp</label>
                    <input type="text" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} className="input-field" placeholder="+54 11 1234-5678" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">Sitio web</label>
                    <input type="text" value={form.website} onChange={e => set('website', e.target.value)} className="input-field" placeholder="https://..." />
                  </div>
                </Section>

                {/* 3 — Persona de referencia */}
                <Section title="Persona de referencia" open={open.person} onToggle={() => toggle('person')}>
                  <p className="text-xs text-slate-500 -mt-1">Solo si el contacto de arriba es una empresa</p>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">Nombre</label>
                    <input type="text" value={form.contact_person_name} onChange={e => set('contact_person_name', e.target.value)} className="input-field" placeholder="Nombre del interlocutor" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">Cargo</label>
                    <input type="text" value={form.contact_person_role} onChange={e => set('contact_person_role', e.target.value)} className="input-field" placeholder="Ej: Gerente Comercial" />
                  </div>
                </Section>

                {/* 4 — Dirección */}
                <Section title="Dirección" open={open.address} onToggle={() => toggle('address')}>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">Calle y número</label>
                    <input type="text" value={form.address} onChange={e => set('address', e.target.value)} className="input-field" placeholder="Av. Corrientes 1234" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-400">Ciudad</label>
                      <input type="text" value={form.city} onChange={e => set('city', e.target.value)} className="input-field" placeholder="Buenos Aires" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-400">Provincia</label>
                      <input type="text" value={form.province} onChange={e => set('province', e.target.value)} className="input-field" placeholder="CABA" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">País</label>
                    <input type="text" value={form.country} onChange={e => set('country', e.target.value)} className="input-field" />
                  </div>
                </Section>

                {/* 5 — Notas */}
                <Section title="Notas" open={open.notes} onToggle={() => toggle('notes')}>
                  <textarea
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    rows={4}
                    className="input-field resize-none"
                    placeholder="Observaciones, condiciones especiales, historial…"
                  />
                </Section>
              </div>

              {/* ── COLUMNA DERECHA — Roles ── */}
              <div className="flex flex-col rounded-lg border border-surface-700 p-4">
                <p className="mb-3 text-sm font-medium text-slate-200">Roles</p>

                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar rol..."
                    className="input-field pl-8 text-xs"
                    value={roleSearch}
                    onChange={e => setRoleSearch(e.target.value)}
                  />
                </div>

                {/* Category chips */}
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {visibleCategories.length === 0
                    ? <p className="text-xs text-slate-500">Sin resultados</p>
                    : visibleCategories.map(cat => (
                      <div key={cat.id}>
                        <p className="mb-1.5 text-xs font-semibold" style={{ color: cat.color }}>
                          {cat.label}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.roles.map(role => {
                            const selected = form.roles.includes(role.id)
                            return (
                              <button
                                key={role.id}
                                type="button"
                                onClick={() => toggleRole(role.id)}
                                className="rounded-full px-2.5 py-1 text-xs font-medium transition-all"
                                style={selected
                                  ? { background: cat.color, color: '#fff' }
                                  : { background: `${cat.color}18`, color: cat.color, opacity: 0.75 }
                                }
                              >
                                {role.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  }
                </div>

                {/* is_active toggle — solo en edición */}
                {isEdit && (
                  <label className="mt-4 flex cursor-pointer select-none items-center gap-2.5 border-t border-surface-700 pt-4">
                    <div
                      onClick={() => set('is_active', !form.is_active)}
                      className={`relative h-5 w-9 rounded-full transition-colors ${form.is_active ? 'bg-brand' : 'bg-surface-600'}`}
                    >
                      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-sm text-slate-300">Contacto activo</span>
                  </label>
                )}
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 gap-3 border-t border-surface-700 px-6 py-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim() || cuitInvalid}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear contacto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
