import { useState, useRef } from 'react'
import { CheckCircle, Upload, X, ChevronDown, AlertTriangle, Info } from 'lucide-react'
import {
  OOH_FORMATS, CAMPAIGN_OBJECTIVES, AUDIENCE_INTERESTS,
  NSE_OPTIONS, DIGITAL_FREQUENCIES, CABA_CITIES,
} from '../../lib/constants'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

// ── Presupuesto con formato ARS ──────────────────────────────
// Muestra: $20.000.000   Almacena: "20000000" (solo dígitos)

const arsFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

function formatARS(raw) {
  if (!raw) return ''
  const n = parseInt(raw, 10)
  return isNaN(n) ? '' : arsFormatter.format(n)
}

function BudgetInput({ value, onChange, error }) {
  function handleChange(e) {
    // Quita todo lo que no sea dígito (puntos, comas, espacios, etc.)
    const digits = e.target.value.replace(/[^\d]/g, '')
    onChange(digits)
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={`input-field pl-7 ${error ? 'border-red-500' : ''}`}
        placeholder="500.000"
        value={formatARS(value)}
        onChange={handleChange}
      />
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function SectionHeader({ number, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
        {number}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      // preventDefault en mousedown evita que el browser haga scrollIntoView
      // al enfocar el botón, sin interferir con el click event.
      onMouseDown={e => e.preventDefault()}
      onClick={() => onChange(!checked)}
      className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
        checked
          ? 'border-brand bg-brand/10 text-brand'
          : 'border-surface-700 bg-surface-800 text-slate-400 hover:border-slate-500 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  )
}

// ── Main form ────────────────────────────────────────────────

export default function WizardStep1Form({ formData, setFormData, onSubmit }) {
  const { role, org } = useAuth()
  const [errors, setErrors] = useState({})
  const [imagePreview, setImagePreview] = useState(null)
  const fileRef = useRef(null)

  // Descuento máximo según rol (configurable por owner en Ajustes)
  const maxDiscount = role === 'owner' ? 100
    : role === 'manager' ? (org?.max_discount_manager ?? 30)
    : (org?.max_discount_salesperson ?? 20)
  const discountVal = formData.discountPct ?? 0
  const needsApproval = discountVal > maxDiscount

  function update(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  function updateAudience(field, value) {
    setFormData(prev => ({ ...prev, audience: { ...prev.audience, [field]: value } }))
  }

  function toggleArrayItem(field, value) {
    setFormData(prev => {
      const arr = prev[field] ?? []
      return { ...prev, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
    if (errors[field]) setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  function toggleAudienceItem(field, value) {
    const arr = formData.audience?.[field] ?? []
    updateAudience(field, arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value])
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)
    update('adImageFile', file)
  }

  function validate() {
    const e = {}
    if (!formData.clientName?.trim())   e.clientName  = 'Nombre del cliente requerido'
    if (!formData.objective)            e.objective   = 'Seleccioná un objetivo'
    if (!formData.formats?.length)      e.formats     = 'Seleccioná al menos un formato'
    if (!formData.budget || Number(formData.budget) <= 0)
                                        e.budget      = 'Ingresá un presupuesto válido'
    if (!formData.startDate)            e.startDate   = 'Fecha de inicio requerida'
    if (!formData.endDate)              e.endDate     = 'Fecha de fin requerida'
    if (formData.startDate && formData.endDate && formData.endDate <= formData.startDate)
                                        e.endDate     = 'La fecha de fin debe ser posterior al inicio'
    if (!formData.city)                 e.city        = 'Seleccioná una ciudad'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (validate()) onSubmit()
  }

  const hasDigital = formData.formats?.includes('digital')

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in">

      {/* ── 1. Cliente ─────────────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader number="1" title="Cliente"
          subtitle="Nombre y datos de contacto del anunciante" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nombre del cliente *" placeholder="Ej: Banco Galicia"
            value={formData.clientName} onChange={e => update('clientName', e.target.value)}
            error={errors.clientName} />
          <Input label="Email (opcional)" type="email" placeholder="contacto@cliente.com"
            value={formData.clientEmail} onChange={e => update('clientEmail', e.target.value)} />
        </div>
      </div>

      {/* ── 2. Objetivo ────────────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader number="2" title="Objetivo de campaña *"
          subtitle="¿Qué querés lograr con esta pauta?" />
        {errors.objective && <p className="mb-3 text-xs text-red-400">{errors.objective}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {CAMPAIGN_OBJECTIVES.map(obj => {
            const selected = formData.objective === obj.value
            return (
              <button key={obj.value} type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => update('objective', obj.value)}
                className={`relative rounded-xl border-2 p-4 text-left transition-colors ${
                  selected
                    ? 'border-brand bg-brand/10'
                    : 'border-surface-700 bg-surface-800 hover:border-slate-500'
                }`}>
                {selected && (
                  <CheckCircle className="absolute top-3 right-3 h-4 w-4 text-brand" />
                )}
                {obj.badge && (
                  <span className="absolute top-3 left-3 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30">
                    {obj.badge}
                  </span>
                )}
                <div className={`text-2xl mb-2 ${obj.badge ? 'mt-5' : ''}`}>{obj.icon}</div>
                <p className="text-sm font-semibold text-white">{obj.label}</p>
                <p className="mt-1 text-xs text-slate-500">{obj.desc}</p>
              </button>
            )
          })}
        </div>

        {/* Disclaimer Activación */}
        {formData.objective === 'traffic' && (
          <div className="mt-3 flex gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
            <span className="text-lg shrink-0">📱</span>
            <p className="text-xs text-amber-300/80 leading-relaxed">
              <strong className="text-amber-300">Activación con QR</strong> — Este objetivo incluirá
              códigos QR en los carteles para redirigir al público a una URL, landing page o promoción.
              La integración de tracking de escaneos estará disponible próximamente.
            </p>
          </div>
        )}
      </div>

      {/* ── 3. Formatos ────────────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader number="3" title="Formatos de cartel *"
          subtitle="Seleccioná uno o más formatos. La IA solo considerará los tipos elegidos." />
        {errors.formats && <p className="mb-3 text-xs text-red-400">{errors.formats}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          {OOH_FORMATS.map(fmt => {
            const selected = formData.formats?.includes(fmt.id)
            return (
              <button key={fmt.id} type="button"
                onClick={() => toggleArrayItem('formats', fmt.id)}
                className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                  selected
                    ? `${fmt.borderClass} ${fmt.bgClass}`
                    : 'border-surface-700 bg-surface-800 hover:border-slate-500'
                }`}>
                {selected && (
                  <CheckCircle className={`absolute top-3 right-3 h-4 w-4 ${fmt.colorClass}`} />
                )}
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                  style={{ background: `${fmt.color}18` }}>
                  {fmt.icon}
                </div>
                <p className={`text-sm font-bold ${selected ? fmt.colorClass : 'text-white'}`}>
                  {fmt.label}
                </p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{fmt.desc}</p>
              </button>
            )
          })}
        </div>

        {/* Frecuencia digital */}
        {hasDigital && (
          <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <p className="mb-3 text-sm font-medium text-blue-300">
              📺 Frecuencia para pantallas digitales
            </p>
            <div className="flex flex-wrap gap-2">
              {DIGITAL_FREQUENCIES.map(f => (
                <Toggle key={f.value} label={f.label}
                  checked={formData.digitalFrequency === f.value}
                  onChange={() => update('digitalFrequency', f.value)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Presupuesto, descuento y período ─────────────── */}
      <div className="card p-5">
        <SectionHeader number="4" title="Presupuesto y período *" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Presupuesto del cliente (ARS) *
            </label>
            <BudgetInput value={formData.budget} onChange={v => update('budget', v)} error={errors.budget} />
            {errors.budget && <p className="mt-1 text-xs text-red-400">{errors.budget}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Fecha inicio *
            </label>
            <input type="date" className={`input-field ${errors.startDate ? 'border-red-500' : ''}`}
              value={formData.startDate} onChange={e => update('startDate', e.target.value)} />
            {errors.startDate && <p className="mt-1 text-xs text-red-400">{errors.startDate}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Fecha fin *
            </label>
            <input type="date" className={`input-field ${errors.endDate ? 'border-red-500' : ''}`}
              value={formData.endDate} onChange={e => update('endDate', e.target.value)} />
            {errors.endDate && <p className="mt-1 text-xs text-red-400">{errors.endDate}</p>}
          </div>
        </div>

        {/* Descuento */}
        <div className="mt-4 border-t border-surface-700 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-medium text-slate-300">Descuento al precio de lista</p>
            <div className="group relative">
              <Info className="h-3.5 w-3.5 text-slate-600 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-56 rounded-lg border border-surface-700 bg-surface-800 p-2.5 text-xs text-slate-400 shadow-lg z-10">
                El presupuesto del cliente es fijo. La IA selecciona más carteles porque cada uno cuesta menos con el descuento aplicado.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-28">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                className={`input-field pr-8 text-center ${needsApproval ? 'border-amber-500/70' : ''}`}
                value={discountVal}
                onChange={e => update('discountPct', Math.min(100, Math.max(0, Number(e.target.value))))}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span>
            </div>
            <div className="flex-1 text-xs text-slate-500">
              {discountVal > 0 && formData.budget ? (
                <span className="text-slate-400">
                  Precio efectivo por cartel × {(1 - discountVal / 100).toFixed(2)}
                  {' · '}máx. permitido sin aprobación: <strong className="text-slate-300">{maxDiscount}%</strong>
                </span>
              ) : (
                <span>0% = sin descuento · máx. sin aprobación: <strong className="text-slate-300">{maxDiscount}%</strong></span>
              )}
            </div>
          </div>
          {needsApproval && (
            <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Descuento supera tu límite de {maxDiscount}%. La propuesta quedará en estado
                <strong className="text-amber-200"> "Esperando aprobación"</strong> hasta que un gerente o dueño la apruebe.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Zona geográfica ──────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader number="5" title="Zona geográfica *" />
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Ciudad *</label>
            <div className="relative">
              <select className={`input-field appearance-none pr-8 ${errors.city ? 'border-red-500' : ''}`}
                value={formData.city} onChange={e => update('city', e.target.value)}>
                <option value="">Seleccioná una ciudad</option>
                {CABA_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
            {errors.city && <p className="mt-1 text-xs text-red-400">{errors.city}</p>}
          </div>

          <div>
            <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-300">
              <span>Radio de búsqueda</span>
              <span className="font-bold text-brand">{formData.radiusKm} km</span>
            </label>
            <input type="range" min="1" max="30" step="1"
              className="w-full accent-brand"
              value={formData.radiusKm}
              onChange={e => update('radiusKm', Number(e.target.value))} />
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>1 km</span><span>15 km</span><span>30 km</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. Audiencia ────────────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader number="6" title="Audiencia objetivo"
          subtitle="Ayuda a la IA a seleccionar los mejores soportes para tu target" />

        {/* Age */}
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-slate-300">Rango de edad</p>
          <div className="flex items-center gap-3">
            <input type="number" min="13" max="80" className="input-field w-20 text-center"
              value={formData.audience?.ageMin ?? 18}
              onChange={e => updateAudience('ageMin', Number(e.target.value))} />
            <span className="text-slate-500 text-sm">a</span>
            <input type="number" min="13" max="80" className="input-field w-20 text-center"
              value={formData.audience?.ageMax ?? 55}
              onChange={e => updateAudience('ageMax', Number(e.target.value))} />
            <span className="text-slate-500 text-sm">años</span>
          </div>
        </div>

        {/* Gender */}
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-slate-300">Género</p>
          <div className="flex gap-2 flex-wrap">
            {[{ v: 'all', l: 'Todos' }, { v: 'male', l: 'Hombres' }, { v: 'female', l: 'Mujeres' }].map(g => (
              <Toggle key={g.v} label={g.l}
                checked={(formData.audience?.gender ?? 'all') === g.v}
                onChange={() => updateAudience('gender', g.v)} />
            ))}
          </div>
        </div>

        {/* Interests — usa button para evitar el scrollIntoView del input sr-only */}
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-slate-300">Intereses</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AUDIENCE_INTERESTS.map(i => {
              const checked = (formData.audience?.interests ?? []).includes(i.value)
              return (
                <button
                  key={i.value}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => toggleAudienceItem('interests', i.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors text-left ${
                    checked
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-surface-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {/* Visual checkbox — fixed 14×14, no layout shift */}
                  <div className={`h-3.5 w-3.5 shrink-0 rounded border transition-colors ${
                    checked ? 'border-brand bg-brand' : 'border-slate-600'
                  }`} style={{ minWidth: '14px' }}>
                    {checked && (
                      <svg className="h-full w-full text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  {i.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* NSE */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-300">Nivel socioeconómico</p>
          <div className="flex gap-2 flex-wrap">
            {NSE_OPTIONS.map(n => {
              const checked = (formData.audience?.nse ?? []).includes(n.value)
              return (
                <button key={n.value} type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => toggleAudienceItem('nse', n.value)}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                    checked ? 'border-brand bg-brand/10 text-brand' : 'border-surface-700 text-slate-400 hover:border-slate-500'
                  }`}>
                  <span className="font-bold">{n.label}</span>
                  <span className="ml-1.5 text-xs opacity-70">{n.desc}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── 7. Imagen del anuncio ───────────────────────────── */}
      <div className="card p-5">
        <SectionHeader number="7" title="Imagen del anuncio"
          subtitle="Referencia visual (opcional) para contextualizar la propuesta" />

        {imagePreview ? (
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-40 w-auto rounded-xl object-cover border border-surface-700" />
            <button type="button"
              onClick={() => { setImagePreview(null); update('adImageFile', null) }}
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-surface-700 py-10 transition-colors hover:border-brand/50 hover:bg-brand/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-700">
              <Upload className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-400">Hacé click para subir una imagen</p>
              <p className="text-xs text-slate-600">PNG, JPG, WEBP hasta 5 MB</p>
            </div>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
      </div>

      {/* ── Submit ──────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pb-6">
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          <span>🤖</span>
          Planificar con IA
        </Button>
      </div>
    </form>
  )
}
