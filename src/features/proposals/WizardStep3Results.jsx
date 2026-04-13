import { useState, useRef, useEffect } from 'react'
import {
  MapPin, TrendingUp, DollarSign, Target, Users,
  Save, Printer, MessageCircle, Star,
  Clock, CheckCircle, Tag, Loader2, Info,
  AlertTriangle, RefreshCw,
} from 'lucide-react'
import ProposalMap from './ProposalMap'
import { FORMAT_MAP } from '../../lib/constants'
import { formatCurrency } from '../../lib/utils'
import Button from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'
import { generateProposalPDF, fetchStaticMap } from './generateProposalPDF'
import { supabase } from '../../lib/supabase'

const DIGITAL_FORMATS = new Set(['digital', 'urban_furniture_digital'])

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
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f97316' : '#ef4444'
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

function BillboardCard({ site, availabilityInfo }) {
  const isDigital = DIGITAL_FORMATS.has(site.format)
  const isOccupied = availabilityInfo?.available === false

  return (
    <div className={`card p-3 hover:border-brand/30 transition-colors ${
      isOccupied ? 'border-amber-500/40 bg-amber-500/5' : ''
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
            {site.audience_score != null && (
              <span className="ml-auto shrink-0 text-xs font-semibold"
                style={{ color: site.audience_score >= 80 ? '#22c55e' : site.audience_score >= 60 ? '#f97316' : '#ef4444' }}>
                {site.audience_score}% match
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">{site.address}</p>
        </div>
      </div>

      {/* Fila 2: datos en línea horizontal */}
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
            Cliente: <span className="font-semibold text-emerald-400">{formatCurrency(site.client_price)}</span>
          </span>
        )}
        {site.client_price > 0 && site.client_price === site.list_price && (
          <span className="text-slate-500">
            Precio: <span className="font-semibold text-emerald-400">{formatCurrency(site.client_price)}</span>
          </span>
        )}
      </div>

      {/* Fila 3: justificación */}
      {site.justification && (
        <p className="mt-1.5 text-xs text-slate-600 italic leading-snug">
          "{site.justification}"
        </p>
      )}

      {/* Aviso ocupado */}
      {isOccupied && (() => {
        const freeDate = availabilityInfo.occupiedUntil
          ? new Date(availabilityInfo.occupiedUntil).toLocaleDateString('es-AR', {
              day: '2-digit', month: 'short', year: 'numeric'
            })
          : null
        return (
          <div className="mt-2 flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">
              <span className="font-semibold">Ocupado · {availabilityInfo.occupiedBy}</span>
              {freeDate && <span className="text-amber-600"> · Disponible desde: <span className="text-amber-300 font-medium">{freeDate}</span></span>}
              <span className="text-amber-700"> · Podés ajustar fechas, reemplazarlo o continuar igual.</span>
            </p>
          </div>
        )
      })()}
    </div>
  )
}


function OptionPanel({ option, formData, audienceNote, mapRef, availability = {} }) {
  if (!option) return null
  const { sites = [], rationale } = option

  const formatMix = option.format_mix ?? {}

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

      {/* Rationale */}
      {rationale && (
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
          <div className="flex gap-2.5">
            <Star className="h-4 w-4 text-brand shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300 leading-relaxed">{rationale}</p>
          </div>
        </div>
      )}

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
        const digitalSites  = sites.filter(s => DIGITAL_FORMATS.has(s.format))
        const physicalSites = sites.filter(s => !DIGITAL_FORMATS.has(s.format))

        const doohImpacts   = digitalSites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0)
        const doohInversion = digitalSites.reduce((s, x) => s + (x.client_price ?? 0), 0)

        const offContactos  = physicalSites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0)
        const offInversion  = physicalSites.reduce((s, x) => s + (x.client_price ?? 0), 0)

        const budget    = Number(formData.budget ?? 0)
        const bPct = budget > 0 && option.total_client_price
          ? Math.min(100, Math.round(option.total_client_price / budget * 100))
          : null

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
                <MetricCard icon={DollarSign} label="Total cliente" color="text-emerald-400"
                  value={formatCurrency(option.total_client_price ?? 0)}
                  sub={bPct != null ? `${bPct}% del presupuesto` : ''} />
                <MetricCard icon={TrendingUp} label="Presupuesto restante" color="text-slate-400"
                  value={formatCurrency(option.budget_remaining ?? 0)}
                  sub="Sin asignar" />
                {option.cpm > 0 && (
                  <MetricCard icon={Target} label="CPM general" color="text-purple-400"
                    value={`$${fmtNum(option.cpm)}`}
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
          Carteles seleccionados ({sites.length})
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
              />
            ))
          })()}
        </div>
      </div>
    </div>
  )
}

function PriceBreakdown({ formData, option }) {
  const discount = formData.discountPct ?? 0
  const listTotal  = option?.total_list_price ?? 0
  const clientTotal = option?.total_client_price ?? 0
  const discountAmt = option?.discount_amount ?? Math.round(listTotal * discount / 100)
  const budgetRaw  = Number(formData.budget ?? 0)
  const remaining  = option?.budget_remaining ?? Math.max(0, budgetRaw - clientTotal)
  const gap        = option?.next_billboard_gap ?? 0

  if (!listTotal) return null

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="h-4 w-4 text-brand" />
        <h3 className="text-sm font-semibold text-white">Desglose de precio</h3>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Precio de lista</span>
          <span className={discount > 0 ? 'text-slate-400 line-through' : 'text-slate-200'}>
            {formatCurrency(listTotal)}
          </span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between items-center text-emerald-400">
            <span>Descuento {discount}%</span>
            <span>-{formatCurrency(discountAmt)}</span>
          </div>
        )}
        <div className="flex justify-between items-center font-bold text-white border-t border-surface-700 pt-2">
          <span>Total cliente</span>
          <span className="text-lg">{formatCurrency(clientTotal)}</span>
        </div>
        {remaining > 0 && (
          <div className="flex justify-between items-center text-xs text-slate-500 border-t border-surface-700/50 pt-1.5">
            <span>Presupuesto restante</span>
            <span className="text-slate-400">{formatCurrency(remaining)}</span>
          </div>
        )}
      </div>
      {gap > 0 && (
        <p className="mt-3 text-xs text-blue-400 bg-blue-500/10 rounded-lg px-3 py-2">
          Con {formatCurrency(gap)} más podés agregar el siguiente cartel disponible.
        </p>
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
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          Aprobado por <strong>{formData._approvedBy}</strong> · {formData._approvedAt}
        </div>
      )}
    </div>
  )
}

export default function WizardStep3Results({ results, formData, onSave, saving }) {
  const { profile, org, user } = useAuth()
  const [activeTab, setActiveTab] = useState('A')
  const [saved, setSaved] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const mapARef = useRef(null)
  const mapBRef = useRef(null)

  const [availability, setAvailability] = useState({})
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  useEffect(() => {
    const allSites = [
      ...(results?.optionA?.sites ?? []),
      ...(results?.optionB?.sites ?? []),
    ]
    const physicalSites = allSites.filter(s => !DIGITAL_FORMATS.has(s.format))
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

  const activeOption = activeTab === 'A' ? results?.optionA : results?.optionB
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
      `*${activeOption.title ?? activeTab}*`,
      `• ${sites.length} carteles seleccionados`,
      `• Impactos/mes: ~${((activeOption.total_impacts ?? 0) / 1000).toFixed(0)}k`,
      `• CPM estimado: $${activeOption.cpm ?? '—'}`,
      `• Inversión: ${formatCurrency(activeOption.total_client_price ?? 0, 'ARS')}/mes`,
      ``,
      `Generado con OOH Planner IA`,
    ].join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  async function handleSave() {
    await onSave(activeOption, activeTab)
    setSaved(true)
  }

  async function handlePDF() {
    setGeneratingPDF(true)
    try {
      const sitesForMap = activeOption?.sites ?? []
      const mapBase64 = await fetchStaticMap(sitesForMap)

      const occupiedSiteIds = new Set(
        Object.entries(availability)
          .filter(([, info]) => info?.available === false)
          .map(([id]) => id)
      )

      await generateProposalPDF({
        results,
        formData,
        profile: { ...profile, email: user?.email },
        org,
        mapA: activeTab === 'A' ? mapBase64 : null,
        mapB: activeTab === 'B' ? mapBase64 : null,
        activeOption: activeTab,
        occupiedSiteIds,
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
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
          <button onClick={handlePDF} disabled={generatingPDF}
            className="flex items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm font-medium text-slate-400 hover:bg-surface-700 transition-colors disabled:opacity-50">
            {generatingPDF
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Printer className="h-4 w-4" />}
            <span className="hidden sm:inline">{generatingPDF ? 'Generando…' : 'PDF'}</span>
          </button>
          <Button size="sm" loading={saving} onClick={handleSave}>
            <Save className="h-4 w-4" />
            {saved ? 'Guardada ✓' : 'Guardar propuesta'}
          </Button>
        </div>
      </div>

      {saved && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-400">¡Propuesta guardada!</p>
              <p className="text-xs text-emerald-600 mt-0.5">Podés descargar el PDF, compartir por WhatsApp o crear una nueva.</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <a href="/app/proposals" className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors">
              Ver propuestas
            </a>
            <button
              onClick={() => { setSaved(false); window.location.href = '/app/proposals/new' }}
              className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 transition-colors"
            >
              Nueva propuesta
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 rounded-xl border border-surface-700 bg-surface-800 p-1">
        {[
          { key: 'A', label: results?.optionA?.title ?? 'Máximo Alcance' },
          { key: 'B', label: results?.optionB?.title ?? 'Máximo Impacto' },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSaved(false) }}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-brand text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}>
            <span className="font-bold mr-1.5">{tab.key === 'A' ? '⚡' : '🎯'}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Verificando disponibilidad */}
      {checkingAvailability && (
        <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Verificando disponibilidad de carteles...
        </div>
      )}

      {/* Price breakdown */}
      <PriceBreakdown formData={formData} option={activeOption} />

      {/* Active option content */}
      <OptionPanel option={activeOption} formData={formData} audienceNote={audienceNote} mapRef={activeTab === 'A' ? mapARef : mapBRef} availability={availability} />

      {/* Hidden panels para captura de ambos mapas */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '600px', height: '300px', pointerEvents: 'none' }}>
        <OptionPanel option={results?.optionA} formData={formData} audienceNote={null} mapRef={mapARef} />
      </div>
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '600px', height: '300px', pointerEvents: 'none' }}>
        <OptionPanel option={results?.optionB} formData={formData} audienceNote={null} mapRef={mapBRef} />
      </div>
    </div>
  )
}
