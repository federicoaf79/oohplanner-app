import { useState, useRef, useEffect } from 'react'
import {
  MapPin, TrendingUp, DollarSign, Target, Users,
  Save, Printer, MessageCircle, Star,
  Clock, CheckCircle, Tag, Loader2, Info,
  AlertTriangle, RefreshCw, Upload, Image, Sun, Moon,
} from 'lucide-react'
import ProposalMap from './ProposalMap'
import { FORMAT_MAP } from '../../lib/constants'
import { formatCurrency } from '../../lib/utils'
import Button from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'
import { generateProposalPDF, fetchStaticMap } from './generateProposalPDF'
import { generateMockup } from '../../lib/generateMockup'
import { validateArtwork } from '../../lib/validateArtwork'
import { supabase } from '../../lib/supabase'
import AudienceMetrics from '../../components/AudienceMetrics'

const DIGITAL_FORMATS = new Set(['digital', 'urban_furniture_digital'])

// Mapeo formato → tipo de arte para mockup
const FORMAT_TO_ART = {
  billboard: 'h',
  digital: 'h',
  ambient: 'v',
  urban_furniture: 'v',
  urban_furniture_digital: 'v',
  poster: 'v',
  mobile_screen: 'sq',
}

// Specs visibles cuando el slot de arte está vacío.
// El peso refleja el límite real de validateArtwork.js (5 MB).
const SLOT_SPECS = {
  h:  { px: '1920 × 1080 px', ratio: '16:9', peso: 'Máx 5 MB' },
  v:  { px: '1080 × 1920 px', ratio: '9:16', peso: 'Máx 5 MB' },
  sq: { px: '1080 × 1080 px', ratio: '1:1',  peso: 'Máx 5 MB' },
}

function fmtNum(n) {
  if (!n && n !== 0) return '—'
  return Math.round(Number(n)).toLocaleString('es-AR')
}

function MetricCard({ icon: Icon, label, value, sub, color = 'text-brand' }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{label}</p>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function FormatBadge({ format }) {
  const f = FORMAT_MAP[format]
  if (!f) return null
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: `${f.color}18`, color: f.color }}>
      {f.label}
    </span>
  )
}

function ScoreBar({ score }) {
  const color = score >= 80 ? '#14b8a6' : score >= 60 ? '#f97316' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-700 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{score}%</span>
    </div>
  )
}

// ── Cálculo de precios parciales ────────────────────────────────────────────
function calcPartialOptions(listPrice, discountPct, occupiedUntil) {
  const occupied = new Date(occupiedUntil)
  const freeDate = new Date(occupied)
  freeDate.setDate(freeDate.getDate() + 1)

  // días remanentes en el mes de liberación
  const lastDay = new Date(freeDate.getFullYear(), freeDate.getMonth() + 1, 0)
  const daysRemaining = lastDay.getDate() - freeDate.getDate() + 1

  // primer día del mes siguiente al de liberación
  const nextMonth = new Date(freeDate.getFullYear(), freeDate.getMonth() + 1, 1)

  const factor = 1 - discountPct / 100

  return {
    freeDate,
    daysRemaining,
    opt1: {
      label:       `Días remanentes (${daysRemaining}d) + mes completo`,
      clientPrice: Math.round((listPrice / 30 * daysRemaining + listPrice) * factor),
      listPrice:   Math.round(listPrice / 30 * daysRemaining + listPrice),
      startDate:   freeDate.toISOString().slice(0, 10),
    },
    opt2: {
      label:       'Mes completo desde liberación',
      clientPrice: Math.round(listPrice * factor),
      listPrice:   listPrice,
      startDate:   nextMonth.toISOString().slice(0, 10),
    },
  }
}

function BillboardCard({ site, availabilityInfo, discountPct = 0, partialSelection, onSelectPartial }) {
  const isDigital  = DIGITAL_FORMATS.has(site.format)
  const isOccupied = availabilityInfo?.available === false
  const hasPartial = !!partialSelection

  const partial = isOccupied && availabilityInfo?.occupiedUntil
    ? calcPartialOptions(site.list_price ?? 0, discountPct, availabilityInfo.occupiedUntil)
    : null

  const freeDateLabel = availabilityInfo?.occupiedUntil
    ? new Date(availabilityInfo.occupiedUntil).toLocaleDateString('es-AR', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    : null

  return (
    <div className={`card p-3 transition-colors ${
      isOccupied && !hasPartial ? 'border-amber-500/40 bg-amber-500/5' :
      hasPartial               ? 'border-brand/40 bg-brand/5' :
      'hover:border-brand/30'
    }`}>
      {/* Fila 1: foto + nombre + formato + match */}
      <div className="flex items-center gap-3">
        {site.photo_url ? (
          <img src={site.photo_url} alt={site.name}
            className="shrink-0 h-10 w-14 rounded object-cover" />
        ) : (
          <div className="shrink-0 h-10 w-14 rounded bg-surface-700 flex items-center justify-center">
            <MapPin className="h-4 w-4 text-slate-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">
              {site.name}
              {site.is_mandatory && (
                <span className="ml-1.5 text-xs font-medium text-amber-400">★ Obligatorio</span>
              )}
            </p>
            <FormatBadge format={site.format} />
            {site.justification === 'Agregado manualmente' && (
              <span className="rounded-full bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                + Agregado
              </span>
            )}
            {site.audience_score != null && (
              <span className="ml-auto shrink-0 text-xs font-semibold"
                style={{ color: site.audience_score >= 80 ? '#14b8a6' : site.audience_score >= 60 ? '#f97316' : '#ef4444' }}>
                {site.audience_score}% match
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">{site.address}</p>
        </div>
      </div>

      {/* Fila 2: datos */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {site.monthly_impacts > 0 && (
          <span className="text-slate-500">
            {isDigital ? 'Impactos/mes' : 'Contactos/mes'}:{' '}
            <span className="font-medium text-slate-300">
              {Math.round(site.monthly_impacts).toLocaleString('es-AR')}
            </span>
          </span>
        )}
        {site.list_price > 0 && (
          <span className="text-slate-500">
            Lista: <span className="font-medium text-slate-300">{formatCurrency(site.list_price)}</span>
          </span>
        )}
        {site.client_price > 0 && site.client_price !== site.list_price && (
          <span className="text-slate-500">
            Cliente: <span className="font-semibold text-brand">{formatCurrency(site.client_price)}</span>
          </span>
        )}
        {site.client_price > 0 && site.client_price === site.list_price && (
          <span className="text-slate-500">
            Precio: <span className="font-semibold text-brand">{formatCurrency(site.client_price)}</span>
          </span>
        )}
      </div>

      {/* Fila 3: justificación */}
      {site.justification && (
        <p className="mt-1.5 text-xs text-slate-600 italic leading-snug">
          "{site.justification}"
        </p>
      )}

      {/* Aviso ocupado + opciones parciales */}
      {isOccupied && (
        <div className="mt-2 space-y-2">
          <div className="flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">
              <span className="font-semibold">Ocupado · {availabilityInfo.occupiedBy}</span>
              {freeDateLabel && (
                <span className="text-amber-600"> · Libre desde: <span className="text-amber-300 font-medium">{freeDateLabel}</span></span>
              )}
            </p>
          </div>

          {/* Opciones de venta parcial */}
          {partial && onSelectPartial && (
            <div className="rounded-lg border border-surface-600 bg-surface-800/60 p-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 mb-2">¿Vendés el remanente?</p>
              {[
                { num: 1, data: partial.opt1 },
                { num: 2, data: partial.opt2 },
              ].map(({ num, data }) => {
                const isSelected = partialSelection?.opt === num
                return (
                  <button
                    key={num}
                    onClick={() => onSelectPartial(site.id, isSelected ? null : { opt: num, ...data })}
                    className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-all border ${
                      isSelected
                        ? 'border-brand/60 bg-brand/15 text-brand/80'
                        : 'border-surface-600 bg-surface-700/50 text-slate-400 hover:border-brand/40 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Opción {num}: {data.label}</span>
                      <span className={`font-bold ${isSelected ? 'text-brand' : 'text-slate-300'}`}>
                        {formatCurrency(data.clientPrice)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Desde {data.startDate} · Lista {formatCurrency(data.listPrice)}
                    </div>
                  </button>
                )
              })}
              {hasPartial && (
                <button
                  onClick={() => onSelectPartial(site.id, null)}
                  className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors w-full text-right pt-0.5"
                >
                  Quitar selección parcial
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


function OptionPanel({ option, formData, audienceNote, mapRef, availability = {}, partialSelections = {}, onSelectPartial }) {
  if (!option) return null
  const { sites = [], rationale } = option

  const availableSites = sites.filter(s => {
    if (DIGITAL_FORMATS.has(s.format)) return true
    if (availability[s.id]?.available !== false) return true
    return !!partialSelections[s.id]  // parcialmente ocupado pero con selección del vendedor
  })

  const formatMix = availableSites.reduce((acc, s) => {
    acc[s.format] = (acc[s.format] || 0) + 1
    return acc
  }, {})

  const budgetPct = (() => {
    const budget = Number(formData.budget ?? 0)
    if (!budget || !option.total_client_price) return null
    return Math.min(100, Math.round((option.total_client_price / budget) * 100))
  })()

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Audience geographic-only note */}
      {audienceNote && (
        <div className="flex gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300/90 leading-relaxed">{audienceNote}</p>
        </div>
      )}

      {/* Rationale — movido al ícono ⓘ en los tabs */}

      {/* Banner de disponibilidad */}
      {(() => {
        const conflicts = (option?.sites ?? []).filter(s =>
          !DIGITAL_FORMATS.has(s.format) && availability[s.id]?.available === false
        )
        if (conflicts.length === 0) return null
        return (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400">
                {conflicts.length} cartel{conflicts.length > 1 ? 'es ocupados' : ' ocupado'} en las fechas solicitadas
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Revisá los carteles marcados abajo y coordiná con el cliente antes de guardar.
              </p>
            </div>
          </div>
        )
      })()}

      {/* Metrics — separado OFF vs DOOH */}
      {(() => {
        const digitalSites  = availableSites.filter(s => DIGITAL_FORMATS.has(s.format))
        const physicalSites = availableSites.filter(s => !DIGITAL_FORMATS.has(s.format))

        const doohImpacts   = digitalSites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0)
        const doohInversion = digitalSites.reduce((s, x) => s + (x.client_price ?? 0), 0)

        const offContactos  = physicalSites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0)
        const offInversion  = physicalSites.reduce((s, x) => s + (x.client_price ?? 0), 0)

        const budget = Number(formData.budget ?? 0)
        const discount = formData.discountPct ?? 0
        const recalcTotal = availableSites.reduce((s, x) => {
          const price = partialSelections[x.id]?.clientPrice
            ?? (x.client_price > 0 ? x.client_price : Math.round((x.list_price ?? 0) * (1 - discount / 100)))
          return s + price
        }, 0)
        const bPct = budget > 0 && recalcTotal
          ? Math.min(100, Math.round(recalcTotal / budget * 100))
          : null

        const totalImps = availableSites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0)
        const cpm = totalImps > 0 ? Math.round(recalcTotal / (totalImps / 1000)) : 0

        const hasDigital  = digitalSites.length > 0
        const hasPhysical = physicalSites.length > 0

        return (
          <div className="space-y-3">
            {/* DOOH */}
            {hasDigital && (
              <div>
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span>📺</span> Digital Out of Home (DOOH)
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <MetricCard icon={Users} label="Impactos/mes" color="text-blue-400"
                    value={fmtNum(doohImpacts)}
                    sub={`${digitalSites.length} pantalla${digitalSites.length > 1 ? 's' : ''} · apariciones de spot`} />
                  <MetricCard icon={DollarSign} label="Inversión DOOH" color="text-blue-300"
                    value={formatCurrency(doohInversion)}
                    sub="Con descuento aplicado" />
                  <MetricCard icon={Target} label="Pantallas" color="text-blue-200"
                    value={String(digitalSites.length)}
                    sub="Soportes digitales" />
                </div>
              </div>
            )}

            {/* OFF */}
            {hasPhysical && (
              <div>
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span>🏙️</span> Vía Pública Estática (OFF)
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <MetricCard icon={Users} label="Contactos/mes" color="text-orange-400"
                    value={fmtNum(offContactos)}
                    sub={`${physicalSites.length} soporte${physicalSites.length > 1 ? 's' : ''} · tráfico estimado`} />
                  <MetricCard icon={DollarSign} label="Inversión OFF" color="text-orange-300"
                    value={formatCurrency(offInversion)}
                    sub="Con descuento aplicado" />
                  <MetricCard icon={Target} label="Soportes" color="text-orange-200"
                    value={String(physicalSites.length)}
                    sub="Carteles físicos" />
                </div>
              </div>
            )}

            {/* Global */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span>📊</span> Resumen total
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricCard icon={DollarSign} label="Total cliente" color="text-brand"
                  value={formatCurrency(recalcTotal)}
                  sub={bPct != null ? `${bPct}% del presupuesto` : ''} />
                <MetricCard icon={TrendingUp} label="Presupuesto restante" color="text-slate-400"
                  value={formatCurrency(Math.max(0, budget - recalcTotal))}
                  sub="Sin asignar" />
                {cpm > 0 && (
                  <MetricCard icon={Target} label="CPM general" color="text-purple-400"
                    value={`$${fmtNum(cpm)}`}
                    sub="Costo por mil impactos" />
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Format mix */}
      {Object.keys(formatMix).length > 0 && (
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <span className="text-slate-500 font-medium">Mix:</span>
          {Object.entries(formatMix).filter(([, v]) => v > 0).map(([fmt, count]) => (
            <span key={fmt} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full"
                style={{ background: FORMAT_MAP[fmt]?.color ?? '#64748b' }} />
              <span className="text-slate-400">{FORMAT_MAP[fmt]?.label ?? fmt}: <strong className="text-slate-200">{count}</strong></span>
            </span>
          ))}
        </div>
      )}

      {/* Map */}
      <ProposalMap sites={sites} className="h-64 lg:h-80" mapRef={mapRef} />

      {/* Site cards */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">
          Carteles seleccionados ({availableSites.length}) · para las fechas seleccionadas
        </h3>
        <div className="space-y-3">
          {(() => {
            const sorted = [...sites].sort((a, b) => {
              const aOcc = availability[a.id]?.available === false ? 1 : 0
              const bOcc = availability[b.id]?.available === false ? 1 : 0
              return aOcc - bOcc
            })
            return sorted.map((site, i) => (
              <BillboardCard
                key={site.id ?? i}
                site={site}
                availabilityInfo={availability[site.id]}
                discountPct={formData.discountPct ?? 0}
                partialSelection={partialSelections[site.id]}
                onSelectPartial={onSelectPartial}
              />
            ))
          })()}
        </div>
      </div>
    </div>
  )
}

function PriceBreakdown({ formData, option, onAddNextBillboard }) {
  const discount = formData.discountPct ?? 0
  const listTotal = (option?.sites ?? []).reduce((s, x) => s + (x.list_price ?? 0), 0)
  const clientTotal = (option?.sites ?? []).reduce((s, x) => {
    const price = x.client_price > 0
      ? x.client_price
      : Math.round((x.list_price ?? 0) * (1 - discount / 100))
    return s + price
  }, 0)
  const discountAmt = option?.discount_amount ?? Math.round(listTotal * discount / 100)
  const budgetRaw  = Number(formData.budget ?? 0)
  const remaining  = option?.budget_remaining ?? Math.max(0, budgetRaw - clientTotal)
  const gap        = option?.next_billboard_gap ?? 0
  const nextName   = option?.next_billboard_name ?? null
  const nextId     = option?.next_billboard_id ?? null
  const nextPrice  = option?.next_billboard_price ?? 0

  if (!listTotal) return null

  // ── Detección de overrun: total cliente excede el presupuesto inicial ──
  // (Pasa cuando el vendedor agrega carteles extra acordados con el cliente)
  const isOverrun = budgetRaw > 0 && clientTotal > budgetRaw
  const overrunAmount = isOverrun ? clientTotal - budgetRaw : 0
  const addedCount = (option?.sites ?? []).filter(s => s.justification === 'Agregado manualmente').length

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="h-4 w-4 text-brand" />
        <h3 className="text-sm font-semibold text-white">Desglose de precio</h3>
      </div>
      <div className="space-y-2 text-sm">
        {budgetRaw > 0 && (
          <div className="flex justify-between items-center pb-2 border-b border-surface-700/50">
            <span className="text-slate-500">Presupuesto cliente</span>
            <span className="font-semibold text-slate-300">{formatCurrency(budgetRaw)}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Precio de lista</span>
          <span className={discount > 0 ? 'text-slate-400 line-through' : 'text-slate-200'}>
            {formatCurrency(listTotal)}
          </span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between items-center text-brand">
            <span>Descuento {discount}%</span>
            <span>-{formatCurrency(discountAmt)}</span>
          </div>
        )}
        <div className="flex justify-between items-center font-bold text-white border-t border-surface-700 pt-2">
          <span>Total cliente</span>
          <span className="text-lg">{formatCurrency(clientTotal)}</span>
        </div>
        {remaining > 0 && !isOverrun && (
          <div className="flex justify-between items-center text-xs text-slate-500 border-t border-surface-700/50 pt-1.5">
            <span>Presupuesto restante</span>
            <span className="text-slate-400">{formatCurrency(remaining)}</span>
          </div>
        )}
      </div>
      {isOverrun && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300 leading-relaxed">
            <span className="font-semibold">Inversión {formatCurrency(overrunAmount)} sobre el presupuesto inicial</span>
            {addedCount > 0 && (
              <>
                {' '}— incluye {addedCount === 1 ? '1 cartel agregado posteriormente' : `${addedCount} carteles agregados posteriormente`}
              </>
            )}
          </p>
        </div>
      )}
      {gap > 0 && nextName && (
        <div className="mt-3 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5 space-y-2">
          <p className="text-xs text-brand">
            Con {formatCurrency(gap)} más podés agregar:{' '}
            <span className="font-semibold text-white">{nextName}</span>
            {' '}· {formatCurrency(nextPrice)}
          </p>
          {onAddNextBillboard && nextId && (
            <button onClick={() => onAddNextBillboard(nextId)} className="text-[11px] font-semibold text-brand border border-brand/30 rounded px-2.5 py-1 hover:bg-brand/10 transition-colors">
              + Agregar a la propuesta
            </button>
          )}
        </div>
      )}
      {formData._pendingApproval && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            Descuento {discount}% supera tu límite. La propuesta requiere aprobación de gerente/dueño.
          </p>
        </div>
      )}
      {formData._approvedBy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-brand">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          Aprobado por <strong>{formData._approvedBy}</strong> · {formData._approvedAt}
        </div>
      )}
    </div>
  )
}

export default function WizardStep3Results({ results, setResults, formData, onSave, saving }) {
  const { profile, org, user } = useAuth()
  const [saved, setSaved] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [showRationale, setShowRationale] = useState(false)
  const mapRef = useRef(null)

  const [availability, setAvailability] = useState({})
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [photoEnriched, setPhotoEnriched] = useState(0)
  const [partialSelections, setPartialSelections] = useState({})

  // Estados para métricas de audiencia
  const [audienceData, setAudienceData] = useState(null)
  const [loadingAudience, setLoadingAudience] = useState(false)

  function handleSelectPartial(siteId, data) {
    setPartialSelections(prev => {
      if (!data) { const n = { ...prev }; delete n[siteId]; return n }
      return { ...prev, [siteId]: data }
    })
  }

  // ── Artworks del cliente (override) ──
  const [clientArtH, setClientArtH]   = useState(null) // { file, preview }
  const [clientArtV, setClientArtV]   = useState(null)
  const [clientArtSq, setClientArtSq] = useState(null)
  const [artExpanded, setArtExpanded] = useState(false)
  const [clientArtError, setClientArtError] = useState(null)
  const [pdfTheme, setPdfTheme] = useState('dark')

  async function handleClientArt(slot, file) {
    if (!file) return
    setClientArtError(null)

    const result = await validateArtwork(file, slot)
    if (!result.valid) {
      setClientArtError({ slot, message: result.error })
      return
    }

    const preview = URL.createObjectURL(file)
    const obj = { file, preview }
    if (slot === 'h') setClientArtH(obj)
    else if (slot === 'v') setClientArtV(obj)
    else setClientArtSq(obj)
  }

  function removeClientArt(slot) {
    setClientArtError(null)
    if (slot === 'h') { if (clientArtH?.preview) URL.revokeObjectURL(clientArtH.preview); setClientArtH(null) }
    else if (slot === 'v') { if (clientArtV?.preview) URL.revokeObjectURL(clientArtV.preview); setClientArtV(null) }
    else { if (clientArtSq?.preview) URL.revokeObjectURL(clientArtSq.preview); setClientArtSq(null) }
  }

  // Resolver arte por formato: cliente > org fallback > null
  function getArtworkForFormat(format) {
    const slot = FORMAT_TO_ART[format] ?? 'h'
    if (slot === 'h') return clientArtH?.preview ?? org?.artwork_h_url ?? null
    if (slot === 'v') return clientArtV?.preview ?? org?.artwork_v_url ?? null
    return clientArtSq?.preview ?? org?.artwork_sq_url ?? null
  }

  const hasAnyClientArt = !!(clientArtH || clientArtV || clientArtSq)
  const hasAnyOrgArt = !!(org?.artwork_h_url || org?.artwork_v_url || org?.artwork_sq_url)

  useEffect(() => {
    const physicalSites = (results?.sites ?? []).filter(s => !DIGITAL_FORMATS.has(s.format))
    const uniqueIds = [...new Set(physicalSites.map(s => s.id).filter(Boolean))]
    if (!uniqueIds.length || !formData.startDate || !formData.endDate) return

    setCheckingAvailability(true)
    supabase
      .from('proposal_items')
      .select(`
        site_id, start_date, end_date,
        proposal:proposals!proposal_id(id, client_name, status)
      `)
      .in('site_id', uniqueIds)
      .eq('proposal.status', 'accepted')
      .not('proposal', 'is', null)
      .then(({ data }) => {
        const map = {}
        for (const id of uniqueIds) map[id] = { available: true }
        for (const item of data ?? []) {
          if (!item.start_date || !item.end_date) continue
          const overlaps =
            new Date(item.start_date) <= new Date(formData.endDate) &&
            new Date(item.end_date)   >= new Date(formData.startDate)
          if (overlaps) {
            map[item.site_id] = {
              available:     false,
              occupiedBy:    item.proposal?.client_name ?? 'Otro cliente',
              occupiedUntil: item.end_date,
            }
          }
        }
        setAvailability(map)
        setCheckingAvailability(false)
      })
  }, [results, formData.startDate, formData.endDate])

  // Enriquecer sites con fotos del inventario para la vista previa
  useEffect(() => {
    if (!results?.sites?.length) return
    const siteIds = [...new Set(results.sites.map(s => s.id).filter(Boolean))]
    if (!siteIds.length) return

    supabase
      .from('inventory')
      .select('id, caras, photo_url, image_url')
      .in('id', siteIds)
      .then(({ data }) => {
        if (!data) return
        const photoMap = {}
        for (const inv of data) {
          const caras = Array.isArray(inv.caras) ? inv.caras : []
          photoMap[inv.id] = caras[0]?.photo_url ?? inv.photo_url ?? inv.image_url ?? null
        }
        setResults(prev => {
          if (!prev?.sites) return prev
          return {
            ...prev,
            sites: prev.sites.map(site =>
              site.id && photoMap[site.id] && !site.photo_url
                ? { ...site, photo_url: photoMap[site.id] }
                : site
            ),
          }
        })
        setPhotoEnriched(prev => prev + 1)
      })
  }, [results?.sites?.length])

  // Calcular métricas de audiencia cuando haya resultados
  useEffect(() => {
    async function fetchAudienceData() {
      console.log('🔍 fetchAudienceData iniciado')
      console.log('results?.sites:', results?.sites)
      console.log('formData:', formData)
      
      if (!results?.sites || results.sites.length === 0 || !formData) {
        console.log('❌ Saliendo: no hay sites o formData')
        return
      }

      setLoadingAudience(true)
      
      try {
        const siteIds = results.sites
          .filter(s => s.id && !s.id.startsWith('mock-'))
          .map(s => s.id)

        console.log('📊 Site IDs filtrados:', siteIds)

        if (siteIds.length === 0) {
          console.log('❌ No hay site IDs válidos (todos son mock o sin ID)')
          setLoadingAudience(false)
          return
        }

        const payload = {
          inventory_ids: siteIds,
          filters: {
            age_min: formData.audience?.ageMin || 18,
            age_max: formData.audience?.ageMax || 55,
            gender: formData.audience?.gender === 'all' ? 'Todos' :
                    formData.audience?.gender === 'male' ? 'Hombres' : 
                    formData.audience?.gender === 'female' ? 'Mujeres' : 'Todos',
            nse: formData.audience?.nse || [],
            interests: formData.audience?.interests || []
          }
        }

        console.log('📤 Llamando a Edge Function con payload:', payload)

        const { data, error } = await supabase.functions.invoke(
          'calculate-audience-reach',
          { body: payload }
        )
        
        console.log('📥 Respuesta Edge Function:', { data, error })
        
        if (!error && data) {
          console.log('✅ audienceData actualizado:', data)
          setAudienceData(data)
        } else if (error) {
          console.error('❌ Error calculando audiencia:', error)
        }
      } catch (err) {
        console.error('❌ Error en calculateAudience:', err)
      } finally {
        setLoadingAudience(false)
        console.log('✅ fetchAudienceData finalizado')
      }
    }

    fetchAudienceData()
  }, [results?.sites?.length, formData?.audience])

  const activeOption = results
  const audienceNote = results?.audience_mode === 'geographic_only' ? results?.audience_note : null

  const locationLabel = (formData.cities ?? []).join(', ') || formData.city || '—'

  function handleWhatsApp() {
    if (!activeOption) return
    const { sites = [] } = activeOption
    const text = [
      `*Propuesta OOH — ${formData.clientName}*`,
      `Objetivo: ${formData.objective}`,
      `Zona: ${locationLabel}`,
      ``,
      `*${activeOption.title ?? 'Propuesta'}*`,
      `• ${sites.length} carteles seleccionados`,
      `• Impactos/mes: ~${((activeOption.total_impacts ?? 0) / 1000).toFixed(0)}k`,
      `• CPM estimado: $${activeOption.cpm ?? '—'}`,
      `• Inversión: ${formatCurrency(activeOption.total_client_price ?? 0, 'ARS')}/mes`,
      ``,
      `Generado con OOH Planner IA`,
    ].join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  async function handleAddNextBillboard(siteId) {
    if (!siteId || !results) return
    const { data: inv } = await supabase.from('inventory').select('id, name, address, city, format, latitude, longitude, daily_traffic, base_rate, illuminated').eq('id', siteId).single()
    if (!inv) return
    const discount = formData.discountPct ?? 0
    const newSite = { id: inv.id, name: inv.name, address: inv.address, city: inv.city, format: inv.format, latitude: inv.latitude, longitude: inv.longitude, monthly_impacts: inv.daily_traffic ? inv.daily_traffic * 30 : 0, list_price: inv.base_rate ?? 0, client_price: Math.round((inv.base_rate ?? 0) * (1 - discount / 100)), justification: 'Agregado manualmente', illuminated: inv.illuminated, audience_score: null, is_mandatory: false }
    // Clonar inmutablemente para evitar mutaciones directas
    setResults(prev => {
      if (!prev) return prev
      const currentOpt = prev
      const newOpt = {
        ...currentOpt,
        sites: [...(currentOpt.sites ?? []), newSite],
        total_client_price: (currentOpt.total_client_price ?? 0) + newSite.client_price,
        total_list_price: (currentOpt.total_list_price ?? 0) + newSite.list_price,
        budget_remaining: (currentOpt.budget_remaining ?? 0) - newSite.client_price,
        next_billboard_id: null,
        next_billboard_name: null,
        next_billboard_gap: 0,
      }
      return newOpt
    })
    setPhotoEnriched(prev => prev + 1)
  }

  async function handleSave() {
    await onSave(activeOption, activeOption?.title ?? 'Propuesta', partialSelections)
    setSaved(true)
  }

  async function handlePDF() {
    setGeneratingPDF(true)
    try {
      const occupiedSiteIds = new Set(
        Object.entries(availability)
          .filter(([, info]) => info?.available === false)
          .map(([id]) => id)
      )

      // Enriquecer sites con photo_url, billboard_zone y coordenadas desde inventory
      const optSites = activeOption?.sites ?? []
      const siteIds = optSites.map(s => s.id).filter(Boolean)
      let siteCarasMap = {}

      if (siteIds.length > 0) {
        try {
          const { data: invData } = await supabase
            .from('inventory')
            .select('id, caras, photo_url, image_url, illuminated, width_ft, height_ft, latitude, longitude')
            .in('id', siteIds)

          if (invData) {
            for (const inv of invData) {
              const caras = Array.isArray(inv.caras) ? inv.caras : []
              const cara = caras[0] ?? null
              siteCarasMap[inv.id] = {
                photoUrl: cara?.photo_url ?? inv.photo_url ?? inv.image_url ?? null,
                zone: cara?.billboard_zone ?? null,
                illuminated: inv.illuminated ?? false,
                width: inv.width_ft ?? null,
                height: inv.height_ft ?? null,
                latitude: inv.latitude ?? null,
                longitude: inv.longitude ?? null,
              }
            }
          }
        } catch (err) {
          console.warn('Error fetching inventory for mockups:', err)
        }
      }

      // Enriquecer sites con lat/lng para el mapa estático
      for (const site of optSites) {
        const data = siteCarasMap[site.id]
        if (data) {
          if (!site.latitude && data.latitude) site.latitude = data.latitude
          if (!site.longitude && data.longitude) site.longitude = data.longitude
        }
      }

      // Capturar mapa Leaflet con html2canvas
      let mapBase64 = null
      const activeMapRef = mapRef
      if (activeMapRef?.current) {
        try {
          const html2canvas = (await import('html2canvas')).default
          // Esperar a que las tiles terminen de cargar
          await new Promise(r => setTimeout(r, 1800))
          const canvas = await html2canvas(activeMapRef.current, {
            useCORS:         true,
            allowTaint:      true,
            scale:           1.5,
            backgroundColor: '#0f172a',
            logging:         false,
            ignoreElements:  el => el.classList?.contains('leaflet-control-container'),
          })
          mapBase64 = canvas.toDataURL('image/jpeg', 0.88)
        } catch (err) {
          console.warn('Map capture failed:', err)
        }
      }

      // Construir mapa de artworks para mockups
      const artworkMap = {
        h:  clientArtH?.preview ?? org?.artwork_h_url ?? null,
        v:  clientArtV?.preview ?? org?.artwork_v_url ?? null,
        sq: clientArtSq?.preview ?? org?.artwork_sq_url ?? null,
      }

      // Generar mockups para sites que tengan zone + artwork
      const mockupMap = {}  // siteId -> dataURL del mockup

      // Generar mockups en paralelo (máx 5 concurrentes)
      const mockupTasks = []
      for (const site of optSites) {
        const siteData = siteCarasMap[site.id]
        if (!siteData?.zone || !siteData?.photoUrl) continue

        const artSlot = FORMAT_TO_ART[site.format] ?? 'h'
        const artUrl = artworkMap[artSlot]
        if (!artUrl) continue

        mockupTasks.push(
          generateMockup(siteData.photoUrl, siteData.zone, artUrl, { maxWidth: 800, quality: 0.82 })
            .then(dataUrl => { mockupMap[site.id] = dataUrl })
            .catch(err => console.warn(`Mockup failed for ${site.id}:`, err))
        )
      }

      // Ejecutar en batches de 5
      for (let i = 0; i < mockupTasks.length; i += 5) {
        await Promise.all(mockupTasks.slice(i, i + 5))
      }

      await generateProposalPDF({
        results,
        formData,
        profile: { ...profile, email: user?.email },
        org,
        mapImage: mapBase64,
        activeOption: 'A',
        occupiedSiteIds,
        artworkMap,
        formatToArt: FORMAT_TO_ART,
        mockupMap,
        siteCarasMap,
        pdfTheme,
        audienceData,
      })
    } catch (err) {
      console.error('PDF generation error:', err)
    } finally {
      setGeneratingPDF(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">
            Pauta planificada para <span className="text-brand">{formData.clientName}</span>
          </h2>
          <p className="text-sm text-slate-500">
            {locationLabel} · {formData.startDate} → {formData.endDate}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={handleWhatsApp}
            className="flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-medium text-brand hover:bg-brand/20 transition-colors">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
          <div className="flex items-center rounded-lg border border-surface-700 bg-surface-800 overflow-hidden">
            <button
              onClick={() => setPdfTheme(t => t === 'dark' ? 'light' : 'dark')}
              title={pdfTheme === 'dark' ? 'PDF oscuro (cambiar a claro)' : 'PDF claro (cambiar a oscuro)'}
              className="flex items-center gap-1 px-2 py-2 text-slate-400 hover:bg-surface-700 transition-colors border-r border-surface-700"
            >
              {pdfTheme === 'dark'
                ? <Moon className="h-4 w-4" />
                : <Sun className="h-4 w-4 text-amber-400" />}
            </button>
            <button onClick={handlePDF} disabled={generatingPDF}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-400 hover:bg-surface-700 transition-colors disabled:opacity-50">
              {generatingPDF
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Printer className="h-4 w-4" />}
              <span className="hidden sm:inline">{generatingPDF ? 'Generando…' : 'PDF'}</span>
            </button>
          </div>
          <Button size="sm" loading={saving} onClick={handleSave}>
            <Save className="h-4 w-4" />
            {saved ? 'Guardada ✓' : 'Guardar propuesta'}
          </Button>
        </div>
      </div>

      {saved && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="h-5 w-5 text-brand shrink-0" />
            <div>
              <p className="text-sm font-semibold text-brand">¡Propuesta guardada!</p>
              <p className="text-xs text-brand/60 mt-0.5">Podés descargar el PDF, compartir por WhatsApp o crear una nueva.</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <a href="/app/proposals" className="rounded-lg border border-brand/30 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 transition-colors">
              Ver propuestas
            </a>
            <button
              onClick={() => { setSaved(false); window.location.href = '/app/proposals/new' }}
              className="rounded-lg bg-brand/20 px-3 py-1.5 text-xs font-medium text-brand/80 hover:bg-brand/30 transition-colors"
            >
              Nueva propuesta
            </button>
          </div>
        </div>
      )}

      {/* Panel artwork cliente */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setArtExpanded(!artExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-700/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Image className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-white">Artes para mockup</span>
            {hasAnyClientArt && (
              <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs font-medium text-brand">
                Arte cliente
              </span>
            )}
            {!hasAnyClientArt && hasAnyOrgArt && (
              <span className="rounded-full bg-surface-700 px-2 py-0.5 text-xs font-medium text-slate-400">
                Usando arte empresa
              </span>
            )}
            {!hasAnyClientArt && !hasAnyOrgArt && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                Sin arte
              </span>
            )}
          </div>
          <span className={`text-slate-500 transition-transform ${artExpanded ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {artExpanded && (
          <div className="px-4 pb-4 pt-1 border-t border-surface-700">
            <p className="text-xs text-slate-500 mb-3">
              Subí el arte del cliente para generar mockups en el PDF. Si no subís nada, se usan los artes de empresa como fallback.
            </p>
            {clientArtError && (
              <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                <svg className="h-4 w-4 text-red-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-xs text-red-300 leading-relaxed">{clientArtError.message}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'h',  label: 'Horizontal', aspect: '16:9', state: clientArtH, orgFallback: org?.artwork_h_url, ratio: 'aspect-video' },
                { key: 'v',  label: 'Vertical',   aspect: '9:16', state: clientArtV, orgFallback: org?.artwork_v_url, ratio: 'aspect-[9/16]' },
                { key: 'sq', label: 'Cuadrado',   aspect: '1:1',  state: clientArtSq, orgFallback: org?.artwork_sq_url, ratio: 'aspect-square' },
              ].map(slot => (
                <div key={slot.key} className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-slate-400 text-center">{slot.label} ({slot.aspect})</p>

                  {slot.state ? (
                    /* Arte del cliente subido */
                    <div className="relative rounded-lg overflow-hidden border border-brand/40 bg-surface-700">
                      <div className={`${slot.ratio} w-full`}>
                        <img src={slot.state.preview} alt={slot.label}
                          className="absolute inset-0 w-full h-full object-cover" />
                      </div>
                      <button onClick={() => removeClientArt(slot.key)}
                        className="absolute top-1 right-1 rounded-full bg-slate-900/80 p-0.5 text-slate-400 hover:text-red-400 transition-colors">
                        <span className="sr-only">Quitar</span>
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                      <div className="absolute bottom-1 left-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Cliente
                      </div>
                    </div>
                  ) : slot.orgFallback ? (
                    /* Fallback de empresa */
                    <label className="cursor-pointer">
                      <div className="relative rounded-lg overflow-hidden border border-surface-600 bg-surface-700 opacity-70 hover:opacity-100 transition-opacity">
                        <div className={`${slot.ratio} w-full`}>
                          <img src={slot.orgFallback} alt={slot.label}
                            className="absolute inset-0 w-full h-full object-cover" />
                        </div>
                        <div className="absolute bottom-1 left-1 rounded bg-surface-800/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                          Empresa
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                          <Upload className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <input type="file" accept="image/jpeg,image/png" className="hidden"
                        onChange={e => { handleClientArt(slot.key, e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                  ) : (
                    /* Sin arte — mostrar specs recomendadas */
                    <label className="cursor-pointer">
                      <div className={`${slot.ratio} w-full rounded-lg border-2 border-dashed border-surface-600 bg-surface-800/30 flex flex-col items-center justify-center gap-2 p-2 hover:border-brand/40 transition-colors text-center`}>
                        <Upload className="h-4 w-4 text-slate-500" />
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-medium text-slate-400 leading-tight">{SLOT_SPECS[slot.key].px}</p>
                          <p className="text-[10px] text-slate-600 leading-tight">{SLOT_SPECS[slot.key].ratio} · {SLOT_SPECS[slot.key].peso}</p>
                        </div>
                        <span className="text-[10px] text-brand font-medium">Subir</span>
                      </div>
                      <input type="file" accept="image/jpeg,image/png" className="hidden"
                        onChange={e => { handleClientArt(slot.key, e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                  )}

                  {/* Botón cambiar si hay arte de cliente */}
                  {slot.state && (
                    <label className="cursor-pointer text-center">
                      <span className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">Cambiar</span>
                      <input type="file" accept="image/jpeg,image/png" className="hidden"
                        onChange={e => { handleClientArt(slot.key, e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Estrategia seleccionada */}
      {results?.title && (
        <div className="flex items-center gap-3 rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-3">
          <span className="text-lg">{results.title === 'Máximo Impacto' ? '🎯' : '⚡'}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{results.title}</p>
            {results.rationale && showRationale && (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{results.rationale}</p>
            )}
          </div>
          {results.rationale && (
            <button
              onClick={() => setShowRationale(v => !v)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Ver estrategia"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Verificando disponibilidad */}
      {checkingAvailability && (
        <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Verificando disponibilidad de carteles...
        </div>
      )}

      {/* Price breakdown */}
      <PriceBreakdown formData={formData} option={activeOption} onAddNextBillboard={handleAddNextBillboard} />

      {/* Métricas de Audiencia */}
      {audienceData && (
        <AudienceMetrics 
          data={audienceData} 
          loading={loadingAudience}
        />
      )}

      {/* Active option content */}
      <OptionPanel option={activeOption} formData={formData} audienceNote={audienceNote} mapRef={mapRef} availability={availability} partialSelections={partialSelections} onSelectPartial={handleSelectPartial} />
    </div>
  )
}
