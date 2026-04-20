import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown,
  DollarSign, Star, ArrowRight, Activity, CheckCircle,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { FORMAT_MAP } from '../../lib/constants'
import { calculateMonthCloseRate, calculateHistoricalCloseRate } from '../../lib/closeRate'
import Spinner from '../../components/ui/Spinner'
import ProposalMap from '../../features/proposals/ProposalMap'

// ─── Helpers ─────────────────────────────────────────────────

function fmtARS(v) {
  if (!v && v !== 0) return '—'
  return '$' + Math.round(Number(v)).toLocaleString('es-AR')
}
function fmtPct(v) {
  if (v == null) return '—'
  return Number(v).toFixed(1) + '%'
}
function shortDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}
function periodBounds(offset = 0) {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + offset
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end:   new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  }
}

const DIGITAL = new Set(['digital', 'urban_furniture_digital'])

// Orden de display para el semáforo
const WF_PILLS = [
  { key: 'active',       label: 'Activas',        color: '#14b8a6' },
  { key: 'colocation', label: 'En colocación', color: '#3b82f6' },
  { key: 'printing',     label: 'En impresión',   color: '#f59e0b' },
  { key: 'approved',     label: 'Aprobadas',      color: '#14b8a6' },
  { key: 'renew',        label: 'Renovadas',      color: '#a855f7' },
  { key: 'withdraw',     label: 'Retiradas',      color: '#f97316' },
  { key: 'pending',      label: 'Sin activar',    color: '#64748b' },
]

// ─── Shared UI ────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color = 'text-brand', bg = 'bg-brand/10' }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <div className={`rounded-lg p-2 ${bg}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-white leading-none">{value ?? '—'}</p>
      {sub && <p className="mt-1.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function EmptyCard({ children }) {
  return (
    <div className="card p-6 text-center text-sm text-slate-600">{children}</div>
  )
}

// ─── FIX 2 — Semáforo de campañas ────────────────────────────

function WorkflowSemaphore({ counts }) {
  const pills = WF_PILLS.filter(p => (counts[p.key] ?? 0) > 0)
  if (pills.length === 0) {
    return (
      <div className="flex h-full min-h-[160px] items-center justify-center text-xs text-slate-600">
        Sin campañas activadas en este período
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {pills.map(p => (
        <div
          key={p.key}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: `${p.color}12`, border: `1px solid ${p.color}35` }}
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
          <span className="text-2xl font-bold leading-none text-white">{counts[p.key]}</span>
          <span className="text-xs text-slate-400">{p.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Derived data computation ─────────────────────────────────

function computeDerived(
  { inventory, items, proposals, allProposals, userProfile, upcomingCampaigns },
  period,
  userId,
  isCompany   // FIX 5: owner/manager ven todas las campañas
) {
  const offset = period === 'current' ? 0 : -1
  const { start: pS, end: pE } = periodBounds(offset)
  const { start: prS, end: prE } = periodBounds(offset - 1)

  // Lookups
  const propById = {}
  proposals.forEach(p => { propById[p.id] = p })
  upcomingCampaigns.forEach(p => { if (!propById[p.id]) propById[p.id] = p })
  const invById = {}
  inventory.forEach(i => { invById[i.id] = i })

  // ── Propuestas creadas en el período (para KPI "Propuestas del período") ──
  const periodCreated = proposals.filter(p => {
    const d = new Date(p.created_at)
    return p.status !== 'draft' && d >= pS && d <= pE
  })

  // ── Propuestas aceptadas en el período (por accepted_at) ──
  const periodProps = proposals.filter(p => {
    const d = new Date(p.accepted_at ?? p.created_at)
    return p.status === 'accepted' && d >= pS && d <= pE
  })
  const periodAcceptedIds = new Set(periodProps.map(p => p.id))

  const prevProps = proposals.filter(p => {
    const d = new Date(p.accepted_at ?? p.created_at)
    return p.status === 'accepted' && d >= prS && d <= prE
  })
  const prevAcceptedIds = new Set(prevProps.map(p => p.id))

  // ── Revenue = SUM(rate) de items de propuestas aceptadas en el período ──
  const revenue     = items.filter(pi => periodAcceptedIds.has(pi.proposal_id)).reduce((s, pi) => s + (pi.client_price ?? pi.rate ?? 0), 0)
  const prevRevenue = items.filter(pi => prevAcceptedIds.has(pi.proposal_id)).reduce((s, pi) => s + (pi.client_price ?? pi.rate ?? 0), 0)
  const revDelta    = prevRevenue > 0 ? (revenue - prevRevenue) / prevRevenue * 100 : null

  // Items solapando período — solo para ocupación física
  function overlap(start, end) {
    return items.filter(pi => {
      if (!pi.start_date || !pi.end_date) return false
      const p = propById[pi.proposal_id]
      if (p?.status !== 'accepted') return false
      return new Date(pi.start_date) <= end && new Date(pi.end_date) >= start
    })
  }
  const currItems = overlap(pS, pE)

  // ── Tasa de cierre del MES: propuestas cerradas en el período / creadas en el período ──
  // Usa allProposals para contemplar todas (KPI empresa ve todo, salesperson ve solo las suyas)
  const scopeProposals = isCompany ? allProposals : proposals
  const monthRateResult = calculateMonthCloseRate(scopeProposals, {
    monthStart: pS,
    monthEnd:   pE,
  })

  // ── Tasa HISTÓRICA: acumulada hasta el último día del mes ANTERIOR al período seleccionado ──
  // (Nunca incluye el mes en curso/parcial — solo meses cerrados)
  const historicalCutoff = new Date(Date.UTC(
    pS.getUTCFullYear(),
    pS.getUTCMonth(),    // mes del período seleccionado
    0,                   // día 0 = último día del mes anterior
    23, 59, 59, 999,
  ))
  const historicalRateResult = calculateHistoricalCloseRate(scopeProposals, {
    asOfDate: historicalCutoff,
  })


  // ── Semáforo de campañas por workflow_status (propuestas aceptadas en el período) ──
  const workflowCounts = {}
  periodProps.forEach(p => {
    const key = (!p.workflow_status || p.workflow_status === 'pending') ? 'pending' : p.workflow_status
    workflowCounts[key] = (workflowCounts[key] ?? 0) + 1
  })

  // ── Mix de formatos con % precalculado (propuestas aceptadas en el período) ──
  const fmtMap = {}
  items.filter(pi => periodAcceptedIds.has(pi.proposal_id)).forEach(pi => {
    const fmt = invById[pi.site_id]?.format
    if (!fmt) return
    if (!fmtMap[fmt]) fmtMap[fmt] = new Set()
    fmtMap[fmt].add(pi.site_id)
  })
  const fmtTotal = Object.values(fmtMap).reduce((s, v) => s + v.size, 0)
  const formatMix = Object.entries(fmtMap)
    .map(([fmt, s]) => ({
      name:  FORMAT_MAP[fmt]?.label ?? fmt,
      value: s.size,
      pct:   fmtTotal > 0 ? Math.round(s.size / fmtTotal * 100) : 0,
      color: FORMAT_MAP[fmt]?.color ?? '#64748b',
    }))
    .sort((a, b) => b.value - a.value)

  // ── Ocupación por formato ──
  const PHYSICAL_FORMATS = ['billboard', 'ambient', 'poster', 'urban_furniture', 'street_furniture', 'mobile_screen']
  const physInv      = inventory.filter(i => !DIGITAL.has(i.format))
  const physOccSet   = new Set(
    currItems.filter(pi => !DIGITAL.has(invById[pi.site_id]?.format)).map(pi => pi.site_id)
  )
  const physTotal    = physInv.length
  const physOccupied = physOccSet.size
  const physPct      = physTotal > 0 ? Math.round(physOccupied / physTotal * 100) : 0

  // Desglose por formato físico
  const occByFormat = PHYSICAL_FORMATS.map(fmt => {
    const total    = inventory.filter(i => i.format === fmt).length
    const occupied = new Set(
      currItems
        .filter(pi => invById[pi.site_id]?.format === fmt)
        .map(pi => pi.site_id)
    ).size
    return { fmt, total, occupied, pct: total > 0 ? Math.round(occupied / total * 100) : 0 }
  }).filter(d => d.total > 0)

  // Actividad DOOH: clientes activos por formato digital
  const doohActivity = ['digital', 'urban_furniture_digital'].map(fmt => {
    const total    = inventory.filter(i => i.format === fmt).length
    const activeClients = new Set(
      currItems
        .filter(pi => invById[pi.site_id]?.format === fmt)
        .map(pi => pi.proposal_id)
    ).size
    return { fmt, total, activeClients }
  }).filter(d => d.total > 0)

  // ── Mi actividad ──
  const myPeriod = proposals.filter(p => {
    if (p.created_by && p.created_by !== userId) return false
    const d = new Date(p.accepted_at ?? p.created_at)
    return d >= pS && d <= pE
  })
  const commPct = userProfile?.commission_pct ?? 0

  // Cerradas = propuestas propias aceptadas en el período (por accepted_at); comisión = SUM(rate)
  const myAcceptedOverlapItems = items.filter(pi => {
    const p = propById[pi.proposal_id]
    if (p?.status !== 'accepted') return false
    if (p.created_by && p.created_by !== userId) return false
    const d = new Date(p.accepted_at ?? p.created_at)
    return d >= pS && d <= pE
  })
  const myClosed     = new Set(myAcceptedOverlapItems.map(pi => pi.proposal_id)).size
  // FIX 1: comisión sobre rate mensual sin duration
  const myCommission = myAcceptedOverlapItems
    .reduce((s, pi) => s + (pi.client_price ?? pi.rate ?? 0) * commPct / 100, 0)

  // Formato top: histórico de todas mis propuestas aceptadas
  const myFmt = {}
  items.filter(pi => {
    const p = propById[pi.proposal_id]
    return p?.status === 'accepted' && p.created_by === userId
  }).forEach(pi => {
    const fmt = invById[pi.site_id]?.format
    if (fmt) myFmt[fmt] = (myFmt[fmt] ?? 0) + 1
  })
  const topFmtKey = Object.entries(myFmt).sort(([, a], [, b]) => b - a)[0]?.[0]
  const topFormat = topFmtKey ? (FORMAT_MAP[topFmtKey]?.label ?? topFmtKey) : null

  // ── Oportunidades: top 5 físicos disponibles por margen ──
  const opportunities = inventory
    .filter(i => i.is_available && !DIGITAL.has(i.format) && (i.base_rate ?? 0) > 0)
    .map(i => {
      const margin = (i.base_rate ?? 0)
        - (i.cost_rent ?? 0) - (i.cost_electricity ?? 0)
        - (i.cost_taxes ?? 0) - (i.cost_maintenance ?? 0) - (i.cost_imponderables ?? 0)
      return { ...i, margin, marginPct: i.base_rate > 0 ? margin / i.base_rate * 100 : 0 }
    })
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5)

  // ── Campañas próximas a vencer (end_date, FIX 3 + FIX 5) ──
  const sitesPerProp = {}
  items.forEach(pi => {
    if (!sitesPerProp[pi.proposal_id]) sitesPerProp[pi.proposal_id] = new Set()
    sitesPerProp[pi.proposal_id].add(pi.site_id)
  })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const activeCampaigns = upcomingCampaigns
    .filter(p => p.end_date)
    // FIX 5: salesperson solo ve sus propias campañas
    .filter(p => isCompany || p.created_by === userId)
    .map(p => ({
      id:        p.id,
      client:    p.client_name ?? '—',
      carteles:  sitesPerProp[p.id]?.size ?? 0,
      startDate: p.start_date ?? p.brief_data?.startDate ?? null,
      endDate:   p.end_date,
      daysLeft:  Math.ceil((new Date(p.end_date) - today) / 86400000),
    }))
    .filter(c => c.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8)

  return {
    revenue, prevRevenue, revDelta,
    totalProposals: periodCreated.length,
    monthRate:      monthRateResult,
    historicalRate: historicalRateResult,
    workflowCounts,
    formatMix,
    physTotal, physOccupied, physPct, occByFormat, doohActivity,
    myInCourse: myPeriod.filter(p => ['draft', 'sent'].includes(p.status)).length,
    myClosed,
    myCommission, commPct, topFormat,
    opportunities,
    activeCampaigns,
    inventoryConCoords: inventory
      .filter(i => i.latitude != null && i.longitude != null)
      .map(i => ({
        site_id:    i.id,
        name:       i.name ?? i.code ?? '—',
        address:    i.address ?? '',
        format:     i.format,
        latitude:   Number(i.latitude),
        longitude:  Number(i.longitude),
        rate:       i.base_rate ?? null,
        owner_type: i.owner_type ?? null,
      })),
  }
}

// ─── Main Dashboard ───────────────────────────────────────────

export default function Dashboard() {
  const { profile, isOwner, isManager } = useAuth()
  const [period, setPeriod] = useState('current')
  const [loading, setLoading] = useState(true)
  const [raw, setRaw] = useState(null)

  useEffect(() => {
    if (!profile?.org_id || !profile?.id) return
    setLoading(true)

    const daysAgo60 = new Date()
    daysAgo60.setDate(daysAgo60.getDate() - 60)
    const today    = new Date()
    const in60     = new Date()
    in60.setDate(in60.getDate() + 60)
    const todayStr = today.toISOString().slice(0, 10)
    const in60Str  = in60.toISOString().slice(0, 10)

    Promise.all([
      // 1 — Inventario completo
      supabase.from('inventory')
        .select('id, name, code, format, is_available, available_until, base_rate, cost_rent, cost_electricity, cost_taxes, cost_maintenance, cost_imponderables, latitude, longitude, address, owner_type')
        .eq('org_id', profile.org_id),

      // 2 — Proposal items con fechas
      supabase.from('proposal_items')
        .select('site_id, proposal_id, rate, duration, start_date, end_date')
        .eq('org_id', profile.org_id),

      // 3 — Propuestas recientes (últimos 60 días) — incluye workflow_status para semáforo (FIX 2)
      supabase.from('proposals')
        .select('id, status, workflow_status, total_value, discount_pct, created_by, created_at, accepted_at, client_name, valid_until')
        .eq('org_id', profile.org_id)
        .gte('created_at', daysAgo60.toISOString()),

      // 4 — Perfil del usuario (comisión)
      supabase.from('profiles')
        .select('commission_pct, monthly_target_ars')
        .eq('id', profile.id)
        .single(),

      // 5 — Campañas aceptadas con end_date en próximos 60 días
      supabase.from('proposals')
        .select('id, status, workflow_status, client_name, start_date, end_date, brief_data, created_at, created_by')
        .eq('org_id', profile.org_id)
        .eq('status', 'accepted')
        .gte('end_date', todayStr)
        .lte('end_date', in60Str),

      // 6 — Todas las propuestas para tasa de cierre global
      supabase.from('proposals')
        .select('id, status')
        .eq('org_id', profile.org_id),

    ]).then(([invR, itemsR, propsR, profileR, campaignsR, allPropsR]) => {
      // Enriquecer items con client_price (aplicar descuento de la propuesta)
      const discountMap = {}
      ;(propsR.data ?? []).forEach(p => { discountMap[p.id] = p.discount_pct ?? 0 })

      const enrichedItems = (itemsR.data ?? []).map(pi => ({
        ...pi,
        client_price: Math.round((pi.rate ?? 0) * (1 - (discountMap[pi.proposal_id] ?? 0) / 100)),
      }))

      setRaw({
        inventory:         invR.data      ?? [],
        items:             enrichedItems,
        proposals:         propsR.data    ?? [],
        allProposals:      allPropsR.data ?? [],
        userProfile:       profileR.error  ? {} : (profileR.data ?? {}),
        upcomingCampaigns: campaignsR.data ?? [],
      })
      setLoading(false)
    })
  }, [profile?.org_id, profile?.id])

  const isCompany = isOwner || isManager

  const derived = useMemo(() => {
    if (!raw || !profile?.id) return null
    return computeDerived(raw, period, profile.id, isCompany)
  }, [raw, period, profile?.id, isCompany])

  if (loading || !derived) {
    return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Header + toggle ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-slate-500">Resumen operativo · OOH Planner</p>
        </div>
        <div className="flex rounded-lg border border-surface-700 bg-surface-800 p-0.5 text-xs">
          {[
            { key: 'current',  label: 'Mes actual' },
            { key: 'previous', label: 'Mes anterior' },
          ].map(o => (
            <button
              key={o.key}
              onClick={() => setPeriod(o.key)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                period === o.key ? 'bg-brand text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FIX 4: SECCIÓN EMPRESA con fondo diferenciado ── */}
      {isCompany && (
        <div className="rounded-2xl border border-slate-700/50 bg-surface-800/60 p-5 space-y-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Empresa</p>

          {/* Métricas empresa — 4 KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

            {/* Revenue */}
            <div className="card p-4">
              <p className="text-xs text-slate-500 mb-1">Revenue período</p>
              <p className="text-xl font-bold text-white">{fmtARS(derived.revenue)}</p>
              {derived.revenue > 0 ? (
                derived.revDelta != null ? (
                  <div className={`flex items-center gap-1 mt-1.5 text-xs ${derived.revDelta >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                    {derived.revDelta >= 0
                      ? <TrendingUp className="h-3 w-3" />
                      : <TrendingDown className="h-3 w-3" />}
                    <span>{derived.revDelta >= 0 ? '+' : ''}{fmtPct(derived.revDelta)} vs mes anterior</span>
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-600">Sin datos período anterior</p>
                )
              ) : derived.totalProposals > 0 ? (
                <p className="mt-1.5 text-xs text-slate-500">
                  Sin ventas cerradas · {derived.totalProposals} propuesta{derived.totalProposals === 1 ? '' : 's'} creada{derived.totalProposals === 1 ? '' : 's'}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-600">Sin actividad este período</p>
              )}
            </div>

            {/* Total propuestas */}
            <div className="card p-4">
              <p className="text-xs text-slate-500 mb-1">Propuestas del período</p>
              <p className="text-xl font-bold text-white">{derived.totalProposals}</p>
              <p className="mt-1.5 text-xs text-slate-600">Creadas en el mes</p>
            </div>

            {/* Tasa de cierre DEL MES */}
            <div className="card p-4">
              <p className="text-xs text-slate-500 mb-1">Tasa del mes</p>
              <p className="text-xl font-bold text-white">
                {derived.monthRate != null ? fmtPct(derived.monthRate.rate) : '—'}
              </p>
              <p className="mt-1.5 text-xs text-slate-600">
                {derived.monthRate != null
                  ? `${derived.monthRate.won} / ${derived.monthRate.total} en el mes`
                  : 'Sin oportunidades en el mes'}
              </p>
            </div>

            {/* Tasa de cierre HISTÓRICA (meses cerrados) */}
            <div className="card p-4">
              <p className="text-xs text-slate-500 mb-1">Tasa histórica</p>
              <p className="text-xl font-bold text-white">
                {derived.historicalRate != null ? fmtPct(derived.historicalRate.rate) : '—'}
              </p>
              <p className="mt-1.5 text-xs text-slate-600">
                {derived.historicalRate != null
                  ? `${derived.historicalRate.won} / ${derived.historicalRate.total} acumulado`
                  : 'Sin histórico todavía'}
              </p>
            </div>

          </div>

          {/* Actividad del período — 3 bloques */}
          <div className="grid gap-4 lg:grid-cols-3">

            {/* A — FIX 2: Semáforo de campañas */}
            <div className="card p-4">
              <p className="mb-3 text-sm font-semibold text-white">Estado de campañas</p>
              <WorkflowSemaphore counts={derived.workflowCounts} />
            </div>

            {/* B — FIX 6: Mix de formatos con % */}
            <div className="card p-4">
              <p className="mb-2 text-sm font-semibold text-white">Mix de formatos vendidos</p>
              {derived.formatMix.length === 0 ? (
                <div className="flex h-[160px] items-center justify-center text-xs text-slate-600">
                  Sin datos en el período
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie
                        data={derived.formatMix}
                        cx="50%" cy="50%"
                        innerRadius={38} outerRadius={58}
                        dataKey="value" nameKey="name"
                      >
                        {derived.formatMix.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, n) => [v, n]}
                        contentStyle={{
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Leyenda con % y cantidad */}
                  <div className="mt-2 space-y-1.5">
                    {derived.formatMix.map((entry, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: entry.color }}
                        />
                        <span className="truncate text-slate-400">{entry.name}</span>
                        <span className="ml-auto shrink-0 font-medium text-slate-300">
                          {entry.pct}% ({entry.value})
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* C — Ocupación discriminada por formato */}
            <div className="card p-4 flex flex-col">
              <p className="mb-3 text-sm font-semibold text-white">Ocupación del Inventario</p>

              {/* OOH Físico */}
              <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-widest mb-2">🏙️ OOH Físico</p>
              <div className="space-y-3 mb-3">
                {derived.occByFormat.map(({ fmt, total, occupied, pct }) => (
                  <div key={fmt}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400 truncate">{FORMAT_MAP[fmt]?.label ?? fmt}</span>
                      <span className="text-xs text-slate-400 shrink-0 ml-2">{occupied}/{total} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-700">
                      <div className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 80 ? '#f97316' : pct >= 50 ? '#6366f1' : '#3b82f6',
                        }} />
                    </div>
                  </div>
                ))}
                {derived.occByFormat.length === 0 && (
                  <p className="text-xs text-slate-600">Sin carteles físicos</p>
                )}
              </div>

              {/* DOOH */}
              {derived.doohActivity.length > 0 && (
                <>
                  <div className="border-t border-surface-700 pt-3 mb-2">
                    <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest mb-2">📺 DOOH Activo</p>
                  </div>
                  <div className="space-y-2">
                    {derived.doohActivity.map(({ fmt, total, activeClients }) => (
                      <div key={fmt} className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">{FORMAT_MAP[fmt]?.label ?? fmt}</span>
                        <span className="text-xs text-slate-300">
                          <span className="font-semibold text-brand">{activeClients}</span> clientes · {total} pantallas
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

          </div>

          {/* ── Mapa de inventario ── */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Mi inventario en el mapa
            </h3>
            {derived.inventoryConCoords.length === 0 ? (
              <EmptyCard>
                Sin ubicaciones cargadas. Agregá latitud y longitud al editar cada cartel desde Inventario.
              </EmptyCard>
            ) : (
              <>
                <ProposalMap
                  sites={derived.inventoryConCoords}
                  mapHeight="350px"
                  getMarkerColor={(item) => {
                    if (item.owner_type === 'owned')  return '#3B82F6'
                    if (item.owner_type === 'rented') return '#F59E0B'
                    return '#64748B'
                  }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#3B82F6' }} />
                    Propios
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#F59E0B' }} />
                    Comercializados
                  </span>
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* ── SECCIÓN MI ACTIVIDAD (todos los roles) ── */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Mi actividad
        </h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="En curso"
            value={derived.myInCourse}
            sub="Borradores y enviadas"
            icon={Activity}
            color="text-blue-400" bg="bg-blue-500/10"
          />
          <KpiCard
            label="Cerradas"
            value={derived.myClosed}
            sub="Aceptadas este período"
            icon={CheckCircle}
            color="text-teal-400" bg="bg-teal-500/10"
          />
          <KpiCard
            label="Comisión estimada"
            value={derived.commPct > 0 ? fmtARS(derived.myCommission) : '—'}
            sub={derived.commPct > 0
              ? `${derived.commPct}% sobre activos`
              : 'Sin comisión configurada'}
            icon={DollarSign}
            color="text-amber-400" bg="bg-amber-500/10"
          />
          <KpiCard
            label="Formato top"
            value={derived.topFormat ?? '—'}
            sub="En propuestas cerradas"
            icon={Star}
            color="text-purple-400" bg="bg-purple-500/10"
          />
        </div>
      </div>

      {/* ── OPORTUNIDADES DE VENTA (todos los roles) ── */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Oportunidades de venta
        </h3>
        {derived.opportunities.length === 0 ? (
          <EmptyCard>No hay carteles físicos disponibles con precio de lista configurado.</EmptyCard>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Cartel</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Formato</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Precio/mes</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Margen</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Rentab.</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {derived.opportunities.map((opp, i) => {
                    const isLast = i === derived.opportunities.length - 1
                    const badge = opp.marginPct > 60
                      ? { label: 'Alta',    cls: 'bg-teal-500/15 text-teal-400' }
                      : opp.marginPct >= 40
                        ? { label: 'Buena',  cls: 'bg-amber-500/15 text-amber-400' }
                        : { label: 'Normal', cls: 'bg-slate-500/15 text-slate-400' }
                    return (
                      <tr
                        key={opp.id}
                        className={`hover:bg-surface-800/50 transition-colors ${isLast ? '' : 'border-b border-surface-700/50'}`}
                      >
                        <td className="px-4 py-3">
                          <p className="max-w-[200px] truncate font-medium text-white">
                            {opp.name ?? opp.code ?? '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs font-medium"
                            style={{ color: FORMAT_MAP[opp.format]?.color ?? '#94a3b8' }}
                          >
                            {FORMAT_MAP[opp.format]?.label ?? opp.format ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-200">
                          {fmtARS(opp.base_rate)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-teal-400">
                          {fmtARS(opp.margin)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to="/app/proposals/new"
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-blue-300 transition-colors"
                          >
                            Proponer <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── CAMPAÑAS PRÓXIMAS A VENCER (todos los roles) ── */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Campañas próximas a vencer
        </h3>
        {derived.activeCampaigns.length === 0 ? (
          <EmptyCard>No hay campañas con vencimiento en los próximos 60 días.</EmptyCard>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Cliente</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Carteles</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Inicio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Vencimiento</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Días rest.</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.activeCampaigns.map((c, i) => {
                    const isLast = i === derived.activeCampaigns.length - 1
                    const badgeCls = c.daysLeft <= 15
                      ? 'bg-red-500/15 text-red-400'
                      : c.daysLeft <= 30
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-teal-500/15 text-teal-400'
                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-surface-800/50 transition-colors ${isLast ? '' : 'border-b border-surface-700/50'}`}
                      >
                        <td className="px-4 py-3 font-medium text-white">{c.client}</td>
                        <td className="px-4 py-3 text-center text-slate-300">{c.carteles}</td>
                        <td className="px-4 py-3 text-slate-400">{shortDate(c.startDate)}</td>
                        <td className="px-4 py-3 text-slate-300">{shortDate(c.endDate)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeCls}`}>
                            {c.daysLeft}d
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}