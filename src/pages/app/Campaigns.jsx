import { useState, useEffect, useMemo, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Search, Megaphone, Calendar, ChevronRight, X, Filter, ChevronDown, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatCurrency } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'
import { WORKFLOW_STATUSES, FORMAT_MAP } from '../../lib/constants'
import ProfitabilityChart from '../../components/ProfitabilityChart'
import { calculateProfitability, calculateSiteProfitability } from '../../lib/profitability'

const EDITABLE_PROD_STATUSES = new Set(['approved', 'printing', 'active'])

// ── Helpers ───────────────────────────────────────────────────

const STATUS_IDX = Object.fromEntries(WORKFLOW_STATUSES.map((s, i) => [s.id, i]))

const WF_LABELS = {
  approved:     'Aprobada',
  printing:     'En impresión',
  colocation: 'En colocación',
  active:       'Activa',
  withdraw:     'Retirada',
  renew:        'Renovada',
}

function getDaysRemaining(validUntil) {
  if (!validUntil) return null
  return Math.ceil((new Date(validUntil) - new Date()) / 86_400_000)
}

function getNextStatus(currentId) {
  const idx = STATUS_IDX[currentId] ?? -1
  if (idx < 0 || idx >= WORKFLOW_STATUSES.length - 1) return null
  return WORKFLOW_STATUSES[idx + 1]
}

function getCampaignTimeStatus(proposal) {
  const items = proposal.proposal_items ?? []
  const starts = items.map(i => i.start_date).filter(Boolean).sort()
  const ends   = items.map(i => i.end_date).filter(Boolean).sort()
  const startDate = starts[0]           ? new Date(starts[0])           : null
  const endDate   = ends[ends.length-1] ? new Date(ends[ends.length-1]) : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (!startDate || !endDate) return { label: 'Fechas pendientes', color: 'amber' }
  if (startDate > today) {
    const days = Math.ceil((startDate - today) / 86_400_000)
    return { label: `En ${days} ${days === 1 ? 'día' : 'días'} inicia`, color: 'blue' }
  }
  if (endDate < today) return { label: 'Campaña finalizada', color: 'slate' }
  const daysActive = Math.floor((today - startDate) / 86_400_000) + 1
  return { label: `Día ${daysActive} de campaña`, color: 'brand' }
}

const BADGE_COLORS = {
  amber: 'bg-amber-500/10 text-amber-400',
  blue:  'bg-blue-500/10 text-blue-400',
  brand: 'bg-brand/10 text-brand',
  slate: 'bg-slate-500/10 text-slate-400',
}

function getCampaignEndDate(proposal) {
  const items = proposal.proposal_items ?? []
  const ends = items.map(i => i.end_date).filter(Boolean).sort()
  return ends[ends.length - 1] ?? proposal.valid_until ?? null
}

function getCampaignStartDate(proposal) {
  const items = proposal.proposal_items ?? []
  const starts = items.map(i => i.start_date).filter(Boolean).sort()
  return starts[0] ?? null
}

// ── Workflow stepper ──────────────────────────────────────────

function WorkflowStepper({ status, onChange, readOnly = false }) {
  const currentIdx = STATUS_IDX[status] ?? -1

  return (
    <div className="flex items-start">
      {WORKFLOW_STATUSES.map((step, idx) => {
        const isActive = idx === currentIdx
        const isDone   = idx < currentIdx

        return (
          <Fragment key={step.id}>
            {idx > 0 && (
              <div className={`flex-1 h-px mt-[9px] transition-colors ${
                isDone ? 'bg-slate-600' : 'bg-surface-700'
              }`} />
            )}
            <button
              type="button"
              onClick={readOnly ? undefined : () => onChange(step.id)}
              className={`flex flex-col items-center gap-1 ${
                readOnly ? 'cursor-default' : 'group'
              }`}
              style={{ minWidth: 0 }}
              title={readOnly ? step.label : `Mover a: ${step.label}`}
            >
              <div
                className={`h-[18px] w-[18px] shrink-0 rounded-full border-2 transition-all ${
                  isDone
                    ? 'border-slate-600 bg-slate-700'
                    : isActive
                      ? 'border-transparent'
                      : 'border-surface-700 bg-surface-800'
                }`}
                style={isActive ? {
                  backgroundColor: step.color,
                  boxShadow: `0 0 0 3px ${step.color}30`,
                  borderColor: step.color,
                } : {}}
              />
              <span
                className={`text-[9px] leading-tight text-center transition-colors ${
                  isActive ? 'font-bold' : isDone ? 'text-slate-600' : 'text-slate-700'
                }`}
                style={isActive ? { color: step.color } : {}}
              >
                {step.label}
              </span>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}

// ── Print measures sub-modal ──────────────────────────────────

function PrintMeasuresModal({ campaign, onClose }) {
  const items = campaign.proposal_items ?? []
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const lines = [`Medidas de impresión — ${campaign.client_name ?? campaign.title}`, '']
    items.forEach((item, i) => {
      const inv = item.site
      const label = [inv?.name, inv?.code ? `(${inv.code})` : null].filter(Boolean).join(' ')
      const dims = inv?.print_width_cm && inv?.print_height_cm
        ? `${inv.print_width_cm} × ${inv.print_height_cm} cm`
        : 'Sin datos'
      lines.push(`${i + 1}. ${label || '—'}: ${dims}`)
    })
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-surface-900 border border-surface-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-surface-700">
          <p className="text-sm font-semibold text-white">Medidas de impresión</p>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-surface-700 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 max-h-[55vh] overflow-y-auto space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">Sin carteles en esta campaña</p>
          )}
          {items.map((item, i) => {
            const inv = item.site ?? null
            const hasMeasures = inv?.print_width_cm && inv?.print_height_cm
            return (
              <div key={item.id ?? i} className="flex items-center justify-between gap-3 rounded-lg bg-surface-800 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{inv?.name ?? '—'}</p>
                  {inv?.code && <p className="text-xs text-slate-500">{inv.code}</p>}
                </div>
                {hasMeasures ? (
                  <span className="shrink-0 text-sm font-bold text-brand">
                    {inv.print_width_cm} × {inv.print_height_cm} cm
                  </span>
                ) : (
                  <Link
                    to="/app/inventory"
                    onClick={onClose}
                    className="shrink-0 text-xs text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
                  >
                    Sin datos — cargar en inventario
                  </Link>
                )}
              </div>
            )
          })}
        </div>
        <div className="p-4 border-t border-surface-700">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full rounded-lg bg-surface-800 border border-surface-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-surface-700 transition-colors"
          >
            {copied ? '¡Copiado!' : 'Copiar al portapapeles'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Production negotiation panel ──────────────────────────────
// Lets owner/manager apply bonificaciones and toggle off production
// components per proposal_item. Writes to proposal_items columns added
// by Block A.1 migration. Read-only preview if workflow status is not
// yet approved.

function ProductionNegotiationPanel({ campaign, items, org, editable, onItemsUpdated }) {
  return (
    <div className="mt-6 rounded-xl border border-surface-700 bg-surface-800/40 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-white">Negociación de Producción</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Ajustá lo que se factura por cartel. Aplicá bonificaciones o remové componentes completos.
          </p>
        </div>
      </div>

      {!editable && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Disponible una vez aprobada la propuesta.
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <ProductionItemRow
            key={item.id}
            item={item}
            campaign={campaign}
            org={org}
            editable={editable}
            onSaved={(updatedItem) => {
              const next = items.map(it => it.id === updatedItem.id ? { ...it, ...updatedItem } : it)
              onItemsUpdated?.(campaign.id, next)
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ProductionItemRow({ item, campaign, org, editable, onSaved }) {
  const [expanded, setExpanded] = useState(false)
  const [printEnabled,     setPrintEnabled]     = useState(!item.produccion_print_disabled)
  const [colocEnabled,     setColocEnabled]     = useState(!item.produccion_colocacion_disabled)
  const [disenoEnabled,    setDisenoEnabled]    = useState(!item.produccion_diseno_disabled)
  const [printPct,         setPrintPct]         = useState(Number(item.produccion_print_ajuste_pct ?? 0))
  const [colocPct,         setColocPct]         = useState(Number(item.produccion_colocacion_ajuste_pct ?? 0))
  const [disenoPct,        setDisenoPct]        = useState(Number(item.produccion_diseno_ajuste_pct ?? 0))
  const [montoFijo,        setMontoFijo]        = useState(Number(item.produccion_ajuste_monto_fijo ?? 0))
  const [motivo,           setMotivo]           = useState(item.produccion_ajuste_motivo ?? '')
  const [saving,           setSaving]           = useState(false)
  const [saved,            setSaved]            = useState(false)

  const site = item.site ?? null
  const fmtLabel = FORMAT_MAP[site?.format]?.label ?? site?.format ?? '—'

  // Compute standard + efectiva on every render — helper is pure and cheap.
  const metrics = useMemo(() => {
    if (!site || !org) return null
    return calculateSiteProfitability(site, {
      months: item.duration || 1,
      itemRate: item.rate,
      discountPct: campaign.discount_pct ?? 0,
      orgProduccionConfig: org,
      produccionAjustes: {
        printPct:           Number(printPct) || 0,
        colocacionPct:      Number(colocPct) || 0,
        disenoPct:          Number(disenoPct) || 0,
        printDisabled:      !printEnabled,
        colocacionDisabled: !colocEnabled,
        disenoDisabled:     !disenoEnabled,
        montoFijo:          Number(montoFijo) || 0,
      },
    })
  }, [site, org, item.duration, item.rate, campaign.discount_pct,
      printPct, colocPct, disenoPct, printEnabled, colocEnabled, disenoEnabled, montoFijo])

  const b = metrics?.cost_breakdown
  const stdTotal = b?.produccion_cobrada_standard ?? 0
  const efeTotal = b?.produccion_cobrada_efectiva ?? 0

  const freeGift = editable && efeTotal === 0 && stdTotal > 0

  async function handleSave() {
    setSaving(true)
    const payload = {
      produccion_print_ajuste_pct:       Math.min(0, Math.max(-100, Number(printPct) || 0)),
      produccion_print_disabled:         !printEnabled,
      produccion_colocacion_ajuste_pct:  Math.min(0, Math.max(-100, Number(colocPct) || 0)),
      produccion_colocacion_disabled:    !colocEnabled,
      produccion_diseno_ajuste_pct:      Math.min(0, Math.max(-100, Number(disenoPct) || 0)),
      produccion_diseno_disabled:        !disenoEnabled,
      produccion_ajuste_monto_fijo:      Math.max(0, Number(montoFijo) || 0),
      produccion_ajuste_motivo:          (motivo || '').slice(0, 500),
    }
    const { data, error } = await supabase
      .from('proposal_items')
      .update(payload)
      .eq('id', item.id)
      .select()
      .single()
    setSaving(false)
    if (error) {
      console.error('save prod ajustes error:', error.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    onSaved?.({ ...item, ...payload, ...(data ?? {}) })
  }

  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800">
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-700/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`} />
          <p className="text-sm font-medium text-white truncate">{site?.name ?? '—'}</p>
          <span className="text-xs text-slate-500 shrink-0">· {fmtLabel}</span>
        </div>
        <div className="flex items-center gap-4 text-xs shrink-0">
          <span className="text-slate-500">Standard: <span className="text-slate-400">{formatCurrency(stdTotal)}</span></span>
          <span className="text-slate-400">Efectivo: <span className={`font-bold ${efeTotal === stdTotal ? 'text-white' : 'text-teal-400'}`}>{formatCurrency(efeTotal)}</span></span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-surface-700 p-4 space-y-4">
          {!metrics && (
            <p className="text-xs text-slate-500 italic">
              Falta configuración de producción de la organización. Configurala en Ajustes Inventario → Costos de Producción.
            </p>
          )}

          {metrics && (
            <>
              <ProductionComponentBlock
                label="Impresión"
                standard={b.impresion_standard}
                efectiva={b.impresion_efectiva}
                enabled={printEnabled}
                onEnabledChange={setPrintEnabled}
                pct={printPct}
                onPctChange={setPrintPct}
                disabled={!editable}
              />
              <ProductionComponentBlock
                label="Colocación"
                standard={b.colocacion_standard}
                efectiva={b.colocacion_efectiva}
                enabled={colocEnabled}
                onEnabledChange={setColocEnabled}
                pct={colocPct}
                onPctChange={setColocPct}
                disabled={!editable}
              />
              <ProductionComponentBlock
                label="Diseño"
                standard={b.diseno_standard}
                efectiva={b.diseno_efectiva}
                enabled={disenoEnabled}
                onEnabledChange={setDisenoEnabled}
                pct={disenoPct}
                onPctChange={setDisenoPct}
                disabled={!editable}
              />

              <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-surface-700">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Bonificación adicional (monto fijo)
                  </label>
                  <div className="relative">
                    <input
                      type="number" min="0" step="1000"
                      className="input-field pl-7 w-full text-sm"
                      value={montoFijo}
                      onChange={e => setMontoFijo(e.target.value)}
                      disabled={!editable}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Motivo del ajuste (opcional)
                  </label>
                  <textarea
                    rows={1}
                    maxLength={500}
                    className="input-field w-full text-sm resize-none"
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    disabled={!editable}
                    placeholder="Ej: regalo campaña, bonificación fidelización…"
                  />
                </div>
              </div>

              {freeGift && (
                <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 text-xs text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  La producción no se cobrará al cliente.
                </div>
              )}

              {editable && (
                <div className="flex items-center justify-end gap-3 pt-2">
                  {saved && <span className="text-xs text-teal-400">✓ Ajustes guardados</span>}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Guardando…' : 'Guardar ajustes'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ProductionComponentBlock({ label, standard, efectiva, enabled, onEnabledChange, pct, onPctChange, disabled }) {
  const bonificado = Math.abs((standard ?? 0) - (efectiva ?? 0)) > 0.5
  return (
    <div className="grid grid-cols-12 items-center gap-3 text-xs">
      <p className="col-span-2 text-sm font-medium text-slate-200">{label}</p>

      <div className="col-span-3">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">Standard</p>
        <p className="text-sm text-slate-400">{formatCurrency(standard ?? 0)}</p>
      </div>

      <div className="col-span-2 flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => !disabled && onEnabledChange(!enabled)}
          disabled={disabled}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            enabled ? 'bg-teal-500' : 'bg-surface-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`} />
        </button>
        <span className="text-[11px] text-slate-500">Facturar</span>
      </div>

      <div className="col-span-2">
        <div className="relative">
          <input
            type="number" min="-100" max="0" step="5"
            value={pct}
            onChange={e => onPctChange(e.target.value)}
            disabled={disabled || !enabled}
            className="input-field w-full text-sm pr-6 text-right disabled:opacity-50"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
        </div>
      </div>

      <div className="col-span-3 text-right">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">Efectivo</p>
        <p className={`text-sm font-bold ${bonificado ? 'text-teal-400' : 'text-white'}`}>
          {formatCurrency(efectiva ?? 0)}
        </p>
      </div>
    </div>
  )
}

// ── Campaign detail modal ─────────────────────────────────────

function CampaignModal({ campaign, onClose, onItemsUpdated }) {
  const { role, org } = useAuth()
  const [showPrint, setShowPrint] = useState(false)
  if (!campaign) return null
  const items    = campaign.proposal_items ?? []
  const brief    = campaign.brief_data ?? {}
  const days     = getDaysRemaining(campaign.valid_until)
  const isExpired = days !== null && days < 0
  const discount = campaign.discount_pct ?? 0

  const DIGITAL = new Set(['digital', 'urban_furniture_digital'])
  const doohItems = items.filter(i => DIGITAL.has(i.site?.format))
  const offItems  = items.filter(i => !DIGITAL.has(i.site?.format))

  const listTotal   = items.reduce((s, i) => s + (i.rate ?? 0), 0)
  const clientTotal = campaign.total_value ?? Math.round(listTotal * (1 - discount / 100))
  const discountAmt = listTotal - clientTotal

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-4xl xl:max-w-5xl rounded-2xl bg-surface-900 border border-surface-700 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-surface-700">
          <div className="min-w-0">
            <p className="font-bold text-white truncate">{campaign.client_name ?? '—'}</p>
            <p className="mt-0.5 text-xs text-slate-500 truncate">{campaign.title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {items.length > 0 && (
              <button type="button" onClick={() => setShowPrint(true)}
                className="rounded-lg border border-surface-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-surface-700 transition-colors">
                📐 Medidas
              </button>
            )}
            <button type="button" onClick={onClose}
              className="rounded-lg p-1 text-slate-500 hover:bg-surface-700 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Columna izquierda ── */}
            <div className="space-y-4">

              {/* Key info grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-800 p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Inversión cliente</p>
                  <p className="font-bold text-white">{formatCurrency(clientTotal)}</p>
                </div>
                <div className="rounded-xl bg-surface-800 p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Vendedor</p>
                  <p className="font-semibold text-white truncate">{campaign.creator?.full_name ?? '—'}</p>
                </div>
                <div className="rounded-xl bg-surface-800 p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Inicio</p>
                  <p className="font-semibold text-slate-300">{formatDate(brief.startDate) ?? '—'}</p>
                </div>
                <div className="rounded-xl bg-surface-800 p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Fin</p>
                  <p className={`font-semibold ${isExpired ? 'text-red-400' : 'text-slate-300'}`}>
                    {formatDate(campaign.valid_until)}
                    {days !== null && !isExpired && <span className="ml-1.5 text-xs text-slate-500">({days}d)</span>}
                    {isExpired && <span className="ml-1.5 text-xs">(vencida)</span>}
                  </p>
                </div>
              </div>

              {/* Resumen financiero */}
              {listTotal > 0 && (
                <div className="rounded-xl bg-surface-800 p-4 space-y-2 text-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Resumen financiero</p>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Precio de lista</span>
                    <span className={discount > 0 ? 'text-slate-500 line-through' : 'text-slate-300'}>
                      {formatCurrency(listTotal)}
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-brand">
                      <span>Descuento {discount}%</span>
                      <span>-{formatCurrency(discountAmt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-white border-t border-surface-700 pt-2">
                    <span>Total cliente</span>
                    <span>{formatCurrency(clientTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Columna derecha ── */}
            <div className="space-y-4">

              {/* Carteles — DOOH */}
              {doohItems.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                    📺 Digital (DOOH) · {doohItems.length} pantalla{doohItems.length > 1 ? 's' : ''}
                  </p>
                  <div className="space-y-1.5">
                    {doohItems.map((item, i) => {
                      const inv = item.site ?? null
                      const listPx = item.rate ?? 0
                      const clientPx = Math.round(listPx * (1 - discount / 100))
                      return (
                        <div key={item.id ?? i} className="rounded-lg bg-surface-800 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-white truncate">{inv?.name ?? '—'}</p>
                            <span className="shrink-0 text-sm font-bold text-brand">{formatCurrency(clientPx)}</span>
                          </div>
                          {inv?.address && <p className="text-xs text-slate-500 truncate mt-0.5">{inv.address}</p>}
                          {listPx > 0 && discount > 0 && (
                            <p className="text-xs text-slate-600 mt-0.5">Lista: {formatCurrency(listPx)}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Carteles — OFF */}
              {offItems.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-orange-400 uppercase tracking-wide flex items-center gap-1.5">
                    🏙️ Vía Pública (OFF) · {offItems.length} soporte{offItems.length > 1 ? 's' : ''}
                  </p>
                  <div className="space-y-1.5">
                    {offItems.map((item, i) => {
                      const inv = item.site ?? null
                      const fmtColor = FORMAT_MAP[inv?.format]?.color
                      const fmtLabel = FORMAT_MAP[inv?.format]?.label ?? inv?.format ?? '—'
                      const listPx = item.rate ?? 0
                      const clientPx = Math.round(listPx * (1 - discount / 100))
                      return (
                        <div key={item.id ?? i} className="rounded-lg bg-surface-800 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-white truncate">{inv?.name ?? '—'}</p>
                            <span className="shrink-0 text-sm font-bold text-brand">{formatCurrency(clientPx)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {inv?.address && <p className="text-xs text-slate-500 truncate flex-1">{inv.address}</p>}
                            <span className="shrink-0 text-xs font-medium" style={{ color: fmtColor ?? '#94a3b8' }}>
                              {fmtLabel}
                            </span>
                          </div>
                          {listPx > 0 && discount > 0 && (
                            <p className="text-xs text-slate-600 mt-0.5">Lista: {formatCurrency(listPx)}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {items.length === 0 && (
                <p className="text-xs text-slate-600 py-2 text-center">Sin carteles registrados</p>
              )}
            </div>
          </div>

          {(role === 'owner' || role === 'manager') && items.length > 0 && (
            <ProductionNegotiationPanel
              campaign={campaign}
              items={items}
              org={org}
              editable={EDITABLE_PROD_STATUSES.has(campaign.workflow_status)}
              onItemsUpdated={onItemsUpdated}
            />
          )}
        </div>
        {showPrint && <PrintMeasuresModal campaign={campaign} onClose={() => setShowPrint(false)} />}
      </div>
    </div>
  )
}

// ── Campaign card ─────────────────────────────────────────────

function CampaignCard({ proposal, canAdvance, canJump, onStatusChange, onAdvance, onOpen, advancing }) {
  const { isOwner } = useAuth()
  const [showMeasures, setShowMeasures] = useState(false)
  const timeStatus = getCampaignTimeStatus(proposal)
  const next       = getNextStatus(proposal.workflow_status)
  const { revenue, costs } = isOwner ? calculateProfitability(proposal) : { revenue: 0, costs: 0 }

  return (
    <div
      className="card p-2.5 hover:border-brand/30 transition-colors cursor-pointer"
      onClick={onOpen}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white truncate">{proposal.title}</p>
          <p className="mt-0.5 text-sm text-slate-500">{proposal.client_name}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${BADGE_COLORS[timeStatus.color]}`}>
            {timeStatus.label}
          </span>
          {isOwner && (
            <ProfitabilityChart
              campaignId={proposal.id}
              revenue={revenue}
              costs={costs}
            />
          )}
        </div>
      </div>

      {/* Meta row */}
      {(() => {
        const items = proposal.proposal_items ?? []
        const starts = items.map(i => i.start_date).filter(Boolean).sort()
        const ends   = items.map(i => i.end_date).filter(Boolean).sort()
        const startDate = starts[0] ?? null
        const endDate   = ends[ends.length - 1] ?? null
        return (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            {proposal.total_value > 0 && (
              <span className="font-semibold text-slate-300">{formatCurrency(proposal.total_value)}</span>
            )}
            {proposal.creator?.full_name && (
              <span className="text-slate-400">· {proposal.creator.full_name}</span>
            )}
            {(startDate || endDate) && (
              <span className="flex items-center gap-1 text-slate-500">
                <Calendar className="h-3 w-3" />
                {startDate ? formatDate(startDate) : '—'}
                {' → '}
                {endDate ? formatDate(endDate) : '—'}
              </span>
            )}
            {items.length > 0 && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setShowMeasures(true) }}
                className="text-xs font-medium text-brand hover:text-blue-300 transition-colors"
              >
                📐 Medidas
              </button>
            )}
          </div>
        )
      })()}
      {showMeasures && (
        <PrintMeasuresModal campaign={proposal} onClose={() => setShowMeasures(false)} />
      )}

      {/* Stepper */}
      <div className="mt-2" onClick={e => e.stopPropagation()}>
        <WorkflowStepper
          status={proposal.workflow_status}
          onChange={(newStatus) => onStatusChange(proposal.id, newStatus)}
          readOnly={!canJump}
        />
      </div>

      {/* Siguiente paso button */}
      {canAdvance && next && (
        <div className="mt-1.5 flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
          <span className="text-xs text-slate-500">Paso siguiente:</span>
          <button
            type="button"
            onClick={() => onAdvance(proposal)}
            disabled={advancing === proposal.id}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
            style={{
              borderColor: `${next.color}50`,
              color: next.color,
              background: `${next.color}10`,
            }}
          >
            {advancing === proposal.id ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {next.label}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function Campaigns() {
  const { profile, isOwner, isManager, isSalesperson } = useAuth()
  const [proposals, setProposals]       = useState([])
  const [loading, setLoading]           = useState(false)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterVendor, setFilterVendor] = useState('todos')
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [advancing, setAdvancing]       = useState(null)
  const [historialOpen, setHistorialOpen] = useState(false)

  useEffect(() => {
    if (!profile?.org_id) return
    setLoading(true)

    async function load() {
      try {
        // Owners get cost fields too (for the profitability chart).
        // Non-owners don't receive cost data in the payload at all.
        const baseSiteFields = 'id, name, code, format, address, print_width_cm, print_height_cm'
        const costSiteFields = ', width_m, height_m, base_rate, cost_rent, cost_electricity, cost_taxes, cost_maintenance, cost_imponderables, cost_print_per_m2, cost_colocation, cost_design, cost_seller_commission_pct, cost_agency_commission_pct, cost_owner_commission_pct, cost_owner_commission'
        const siteFields = isOwner ? baseSiteFields + costSiteFields : baseSiteFields

        let query = supabase
          .from('proposals')
          .select(`
            *,
            creator:profiles!created_by(id, full_name),
            proposal_items(
              id, site_id, rate, start_date, end_date, duration,
              produccion_print_ajuste_pct, produccion_print_disabled,
              produccion_colocacion_ajuste_pct, produccion_colocacion_disabled,
              produccion_diseno_ajuste_pct, produccion_diseno_disabled,
              produccion_ajuste_monto_fijo, produccion_ajuste_motivo,
              site:inventory(${siteFields})
            )
          `)
          .eq('org_id', profile.org_id)
          .neq('workflow_status', 'pending')
          .not('workflow_status', 'is', null)
          .order('created_at', { ascending: false })

        // Salesperson only sees their own campaigns
        if (isSalesperson) {
          query = query.eq('created_by', profile.id)
        }

        const { data, error } = await query
        if (error) console.error('campaigns fetch error:', error.message)
        const rows = data ?? []

        // Auto-withdraw: proposals past real end_date not yet closed
        const today      = new Date()
        const expiredIds = rows
          .filter(p => {
            if (['withdraw', 'renew'].includes(p.workflow_status)) return false
            const endDate = getCampaignEndDate(p)
            return endDate && new Date(endDate) < today
          })
          .map(p => p.id)

        if (expiredIds.length) {
          await supabase.from('proposals')
            .update({ workflow_status: 'withdraw' })
            .in('id', expiredIds)
          setProposals(rows.map(p =>
            expiredIds.includes(p.id) ? { ...p, workflow_status: 'withdraw' } : p
          ))
        } else {
          setProposals(rows)
        }
      } catch (err) {
        console.error('campaigns load error:', err.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [profile?.org_id, profile?.id, isSalesperson, isOwner])

  // Unique vendors derived from loaded campaigns (owner/manager only)
  const vendors = useMemo(() => {
    if (!isOwner && !isManager) return []
    const seen = new Set()
    return proposals
      .filter(p => p.creator?.id && !seen.has(p.creator.id) && seen.add(p.creator.id))
      .map(p => ({ id: p.creator.id, name: p.creator.full_name ?? '—' }))
  }, [proposals, isOwner, isManager])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const allFiltered = useMemo(() => {
    const q = search.toLowerCase()
    return proposals.filter(p => {
      if (filterStatus !== 'todos' && p.workflow_status !== filterStatus) return false
      if ((isOwner || isManager) && filterVendor !== 'todos' && p.created_by !== filterVendor) return false
      return (p.title ?? '').toLowerCase().includes(q) ||
             (p.client_name ?? '').toLowerCase().includes(q)
    })
  }, [proposals, search, filterStatus, filterVendor, isOwner, isManager])

  const enCurso = useMemo(() => {
    return allFiltered
      .filter(p => {
        const end = getCampaignEndDate(p)
        return !end || new Date(end) >= today
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [allFiltered])

  const historial = useMemo(() => {
    return allFiltered
      .filter(p => {
        const end = getCampaignEndDate(p)
        return end && new Date(end) < today
      })
      .sort((a, b) => {
        const ea = getCampaignEndDate(a) ?? ''
        const eb = getCampaignEndDate(b) ?? ''
        return eb.localeCompare(ea)  // DESC: más reciente primero
      })
  }, [allFiltered])

  const pendingWithdraw = useMemo(() =>
    historial.filter(p => !['withdraw', 'renew'].includes(p.workflow_status)),
    [historial]
  )

  async function handleStatusChange(proposalId, newStatus) {
    const { error } = await supabase
      .from('proposals')
      .update({ workflow_status: newStatus })
      .eq('id', proposalId)

    if (error) {
      console.error('status update error:', error.message)
      return
    }
    setProposals(prev => prev.map(p =>
      p.id === proposalId ? { ...p, workflow_status: newStatus } : p
    ))
    // Sync selected campaign if open
    setSelectedCampaign(prev =>
      prev?.id === proposalId ? { ...prev, workflow_status: newStatus } : prev
    )
  }

  async function handleAdvance(campaign) {
    const next = getNextStatus(campaign.workflow_status)
    if (!next) return
    setAdvancing(campaign.id)
    await handleStatusChange(campaign.id, next.id)
    setAdvancing(null)
  }

  function canAdvance(p) {
    return isOwner || isManager || p.created_by === profile?.id
  }

  function handleItemsUpdated(proposalId, updatedItems) {
    setProposals(prev => prev.map(p =>
      p.id === proposalId ? { ...p, proposal_items: updatedItems } : p
    ))
    setSelectedCampaign(prev =>
      prev?.id === proposalId ? { ...prev, proposal_items: updatedItems } : prev
    )
  }

  async function handleWithdrawAll() {
    const ids = pendingWithdraw.map(p => p.id)
    if (!ids.length) return
    await supabase.from('proposals')
      .update({ workflow_status: 'withdraw' })
      .in('id', ids)
    setProposals(prev => prev.map(p =>
      ids.includes(p.id) ? { ...p, workflow_status: 'withdraw' } : p
    ))
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">Campañas</h2>
          <p className="text-sm text-slate-500">{proposals.length} campaña{proposals.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="input-field pl-9 w-full"
            placeholder="Buscar por título o cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <div className="relative flex items-center gap-1.5">
          <Filter className="absolute left-2.5 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="input-field pl-8 pr-8 text-sm appearance-none min-w-[140px]"
          >
            <option value="todos">Todos los estados</option>
            {WORKFLOW_STATUSES.map(s => (
              <option key={s.id} value={s.id}>{WF_LABELS[s.id] ?? s.label}</option>
            ))}
          </select>
        </div>

        {/* Vendor filter (owner/manager only) */}
        {(isOwner || isManager) && vendors.length > 1 && (
          <select
            value={filterVendor}
            onChange={e => setFilterVendor(e.target.value)}
            className="input-field text-sm appearance-none min-w-[140px]"
          >
            <option value="todos">Todos los vendedores</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Notificación campañas sin cerrar */}
      {pendingWithdraw.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-400">
                {pendingWithdraw.length} campaña{pendingWithdraw.length !== 1 ? 's' : ''} vencida{pendingWithdraw.length !== 1 ? 's' : ''} sin cerrar
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Superaron su fecha de fin pero siguen marcadas como activas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleWithdrawAll}
            className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/30 transition-colors"
          >
            Cerrar todas
          </button>
        </div>
      )}

      {/* Lista principal */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-6">

          {/* En curso */}
          {enCurso.length === 0 && historial.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16 text-center">
              <Megaphone className="mb-3 h-10 w-10 text-slate-600" />
              <p className="font-medium text-slate-400">
                {search || filterStatus !== 'todos' || filterVendor !== 'todos'
                  ? 'Sin resultados' : 'Sin campañas activas'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {search || filterStatus !== 'todos' || filterVendor !== 'todos'
                  ? 'Probá con otros filtros' : 'Las propuestas activadas aparecerán aquí'}
              </p>
            </div>
          ) : (
            <>
              {/* Campañas en curso */}
              {enCurso.length > 0 && (
                <div className="space-y-3">
                  {enCurso.map(p => (
                    <CampaignCard
                      key={p.id}
                      proposal={p}
                      canAdvance={canAdvance(p)}
                      canJump={isOwner || isManager}
                      onStatusChange={handleStatusChange}
                      onAdvance={handleAdvance}
                      onOpen={() => setSelectedCampaign(p)}
                      advancing={advancing}
                    />
                  ))}
                </div>
              )}

              {/* Historial */}
              {historial.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setHistorialOpen(v => !v)}
                    className="flex w-full items-center justify-between rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-3 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span>📁</span>
                      Historial — {historial.length} campaña{historial.length !== 1 ? 's' : ''} finalizada{historial.length !== 1 ? 's' : ''}
                    </span>
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${historialOpen ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {historialOpen && (
                    <div className="mt-3 space-y-3">
                      {historial.map(p => (
                        <CampaignCard
                          key={p.id}
                          proposal={p}
                          canAdvance={canAdvance(p)}
                          canJump={isOwner || isManager}
                          onStatusChange={handleStatusChange}
                          onAdvance={handleAdvance}
                          onOpen={() => setSelectedCampaign(p)}
                          advancing={advancing}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Detail modal */}
      {selectedCampaign && (
        <CampaignModal
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
          onItemsUpdated={handleItemsUpdated}
        />
      )}
    </div>
  )
}
