import { useState } from 'react'
import {
  MapPin, TrendingUp, DollarSign, Target, Users,
  Save, Printer, MessageCircle, ChevronRight, Star,
  Clock, CheckCircle, Tag
} from 'lucide-react'
import ProposalMap from './ProposalMap'
import { FORMAT_MAP } from '../../lib/constants'
import { formatCurrency } from '../../lib/utils'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

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

function BillboardCard({ site, idx }) {
  return (
    <div className="card p-4 flex gap-4 hover:border-brand/30 transition-colors">
      {/* Placeholder image */}
      <div className="shrink-0 h-16 w-20 rounded-lg overflow-hidden bg-surface-700 flex items-center justify-center">
        <MapPin className="h-6 w-6 text-slate-600" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-sm font-semibold text-white leading-tight">{site.name}</p>
          <FormatBadge format={site.format} />
        </div>
        <p className="mt-0.5 text-xs text-slate-500 truncate">{site.address}</p>

        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-slate-500">Impactos/mes</span>
          <span className="font-medium text-slate-300">
            {site.impactsPerMonth ? `~${(site.impactsPerMonth / 1000).toFixed(0)}k` : '—'}
          </span>
          <span className="text-slate-500">Tarifa</span>
          <span className="font-medium text-slate-300">{formatCurrency(site.rate, 'ARS')}</span>
        </div>

        {site.audienceMatchScore != null && (
          <div className="mt-2">
            <p className="text-xs text-slate-500 mb-1">Match audiencia</p>
            <ScoreBar score={site.audienceMatchScore} />
          </div>
        )}

        {site.justification && (
          <p className="mt-2 text-xs text-slate-500 italic">"{site.justification}"</p>
        )}
      </div>
    </div>
  )
}

function OptionPanel({ option, formData }) {
  if (!option) return null
  const { sites = [], metrics = {}, rationale } = option

  const formatMix = metrics.formatMix ?? {}

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Rationale */}
      {rationale && (
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
          <div className="flex gap-2.5">
            <Star className="h-4 w-4 text-brand shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300 leading-relaxed">{rationale}</p>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={Users} label="Impactos/mes" color="text-blue-400"
          value={metrics.totalImpactsPerMonth
            ? `${(metrics.totalImpactsPerMonth / 1000).toFixed(0)}k`
            : '—'}
          sub="Impresiones brutas" />
        <MetricCard icon={TrendingUp} label="Alcance estimado" color="text-emerald-400"
          value={metrics.estimatedReach
            ? `${(metrics.estimatedReach / 1000).toFixed(0)}k`
            : '—'}
          sub="Personas únicas" />
        <MetricCard icon={DollarSign} label="CPM estimado" color="text-amber-400"
          value={metrics.estimatedCPM ? `$${metrics.estimatedCPM}` : '—'}
          sub="Costo por mil impactos" />
        <MetricCard icon={Target} label="Presupuesto usado" color="text-purple-400"
          value={metrics.budgetUsedPct ? `${Math.round(metrics.budgetUsedPct)}%` : '—'}
          sub={metrics.totalRate ? formatCurrency(metrics.totalRate, 'ARS') : ''} />
      </div>

      {/* Format mix */}
      {Object.keys(formatMix).length > 0 && (
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <span className="text-slate-500 font-medium">Mix:</span>
          {Object.entries(formatMix).filter(([,v]) => v > 0).map(([fmt, count]) => (
            <span key={fmt} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full"
                style={{ background: FORMAT_MAP[fmt]?.color ?? '#64748b' }} />
              <span className="text-slate-400">{FORMAT_MAP[fmt]?.label ?? fmt}: <strong className="text-slate-200">{count}</strong></span>
            </span>
          ))}
        </div>
      )}

      {/* Map */}
      <ProposalMap sites={sites} className="h-64 lg:h-80" />

      {/* Site cards */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">
          Carteles seleccionados ({sites.length})
        </h3>
        <div className="space-y-3">
          {sites.map((site, i) => (
            <BillboardCard key={site.site_id ?? i} site={site} idx={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PriceBreakdown({ formData, totalListRate }) {
  const discount = formData.discountPct ?? 0
  if (!totalListRate) return null
  const discountAmt  = Math.round(totalListRate * discount / 100)
  const clientTotal  = totalListRate - discountAmt

  // Cuánto falta para agregar 1 cartel más
  const avgRate      = totalListRate / Math.max(1, formData._sitesCount ?? 1)
  const effAvgRate   = Math.round(avgRate * (1 - discount / 100))
  const usedBudget   = clientTotal
  const budgetRaw    = Number(formData.budget ?? 0)
  const remaining    = budgetRaw - usedBudget
  const nextCost     = effAvgRate
  const diffForNext  = nextCost > 0 ? nextCost - remaining : null

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="h-4 w-4 text-brand" />
        <h3 className="text-sm font-semibold text-white">Desglose de precio</h3>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Precio de lista</span>
          <span className="text-slate-400 line-through">{formatCurrency(totalListRate)}</span>
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
      </div>
      {remaining >= 0 && remaining < nextCost && diffForNext > 0 && (
        <p className="mt-3 text-xs text-blue-400 bg-blue-500/10 rounded-lg px-3 py-2">
          Diferencia: {formatCurrency(remaining)} disponible — con {formatCurrency(diffForNext)} más podés agregar 1 cartel
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
  const [activeTab, setActiveTab] = useState('A')
  const [saved, setSaved] = useState(false)

  const activeOption = activeTab === 'A' ? results?.optionA : results?.optionB

  function handleWhatsApp() {
    if (!activeOption) return
    const { metrics, sites = [] } = activeOption
    const text = [
      `*Propuesta OOH — ${formData.clientName}*`,
      `Objetivo: ${formData.objective}`,
      `Ciudad: ${formData.city}`,
      ``,
      `*${activeOption.label}*`,
      `• ${sites.length} carteles seleccionados`,
      `• Impactos/mes: ~${((metrics?.totalImpactsPerMonth ?? 0) / 1000).toFixed(0)}k`,
      `• CPM estimado: $${metrics?.estimatedCPM ?? '—'}`,
      `• Inversión: ${formatCurrency(metrics?.totalRate ?? 0, 'ARS')}/mes`,
      ``,
      `Generado con OOH Planner IA`,
    ].join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  async function handleSave() {
    await onSave(activeOption, activeTab)
    setSaved(true)
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
            {formData.city} · {formData.startDate} → {formData.endDate}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button onClick={handleWhatsApp}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm font-medium text-slate-400 hover:bg-surface-700 transition-colors">
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <Button size="sm" loading={saving} onClick={handleSave}>
            <Save className="h-4 w-4" />
            {saved ? 'Guardada ✓' : 'Guardar propuesta'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 rounded-xl border border-surface-700 bg-surface-800 p-1">
        {[
          { key: 'A', label: results?.optionA?.label ?? 'Opción A' },
          { key: 'B', label: results?.optionB?.label ?? 'Opción B' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSaved(false) }}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-brand text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="font-bold mr-1.5">
              {tab.key === 'A' ? '⚡' : '🎯'}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Price breakdown */}
      <PriceBreakdown
        formData={{ ...formData, _sitesCount: activeOption?.sites?.length ?? 0 }}
        totalListRate={activeOption?.metrics?.totalRate}
      />

      {/* Active option content */}
      <OptionPanel option={activeOption} formData={formData} />
    </div>
  )
}
