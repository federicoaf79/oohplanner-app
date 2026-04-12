import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, FileText, Target, MapPin,
  DollarSign, Star, ArrowRight, Activity, CheckCircle,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { FORMAT_MAP } from '../../lib/constants'
import Spinner from '../../components/ui/Spinner'

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
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return {
    start: new Date(d.getFullYear(), d.getMonth(), 1),
    end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
  }
}

const DIGITAL = new Set(['digital', 'urban_furniture_digital'])

// ─── Shared UI ────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-white">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color ?? '#94a3b8' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

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

function SectionTitle({ children }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
      {children}
    </h3>
  )
}

function EmptyCard({ children }) {
  return (
    <div className="card p-6 text-center text-sm text-slate-600">{children}</div>
  )
}

// ─── Derived data computation ─────────────────────────────────

function computeDerived({ inventory, items, proposals, userProfile, upcomingCampaigns }, period, userId) {
  const offset = period === 'current' ? 0 : -1
  const { start: pS, end: pE } = periodBounds(offset)
  const { start: prS, end: prE } = periodBounds(offset - 1)

  // Lookups
  const propById = {}
  proposals.forEach(p => { propById[p.id] = p })
  upcomingCampaigns.forEach(p => { if (!propById[p.id]) propById[p.id] = p })
  const invById = {}
  inventory.forEach(i => { invById[i.id] = i })

  // Items that overlap a date window AND belong to accepted proposals
  function overlap(start, end) {
    return items.filter(pi => {
      if (!pi.start_date || !pi.end_date) return false
      const p = propById[pi.proposal_id]
      if (p?.status !== 'accepted') return false
      return new Date(pi.start_date) <= end && new Date(pi.end_date) >= start
    })
  }
  const currItems = overlap(pS, pE)
  const prevItems = overlap(prS, prE)

  // ── Revenue ──
  const revenue     = currItems.reduce((s, pi) => s + (pi.rate ?? 0) * (pi.duration ?? 1), 0)
  const prevRevenue = prevItems.reduce((s, pi) => s + (pi.rate ?? 0) * (pi.duration ?? 1), 0)
  const revDelta    = prevRevenue > 0 ? (revenue - prevRevenue) / prevRevenue * 100 : null

  // ── Period proposals (by created_at) ──
  const periodProps = proposals.filter(p => {
    const d = new Date(p.created_at)
    return d >= pS && d <= pE
  })
  const closeable  = periodProps.filter(p => ['sent', 'accepted', 'rejected'].includes(p.status))
  const closeRate  = closeable.length > 0
    ? periodProps.filter(p => p.status === 'accepted').length / closeable.length * 100
    : null

  // ── Weekly billboard chart (weeks of selected period's month) ──
  const yr = pS.getFullYear(), mo = pS.getMonth()
  const weeks = [
    { label: 'S1', s: new Date(yr, mo, 1),  e: new Date(yr, mo, 7, 23, 59, 59) },
    { label: 'S2', s: new Date(yr, mo, 8),  e: new Date(yr, mo, 14, 23, 59, 59) },
    { label: 'S3', s: new Date(yr, mo, 15), e: new Date(yr, mo, 21, 23, 59, 59) },
    { label: 'S4', s: new Date(yr, mo, 22), e: new Date(yr, mo + 1, 0, 23, 59, 59) },
  ]
  const weeklyData = weeks.map(w => ({
    semana: w.label,
    carteles: new Set(
      items.filter(pi => {
        if (!pi.start_date || !pi.end_date) return false
        const p = propById[pi.proposal_id]
        return p?.status === 'accepted' &&
          new Date(pi.start_date) <= w.e && new Date(pi.end_date) >= w.s
      }).map(pi => pi.site_id)
    ).size,
  }))

  // ── Format mix (from current period active items) ──
  const fmtMap = {}
  currItems.forEach(pi => {
    const fmt = invById[pi.site_id]?.format
    if (!fmt) return
    if (!fmtMap[fmt]) fmtMap[fmt] = new Set()
    fmtMap[fmt].add(pi.site_id)
  })
  const formatMix = Object.entries(fmtMap)
    .map(([fmt, s]) => ({
      name:  FORMAT_MAP[fmt]?.label ?? fmt,
      value: s.size,
      color: FORMAT_MAP[fmt]?.color ?? '#64748b',
    }))
    .sort((a, b) => b.value - a.value)

  // ── Physical occupancy (excl. digital formats) ──
  const physInv      = inventory.filter(i => !DIGITAL.has(i.format))
  const physOccSet   = new Set(
    currItems.filter(pi => !DIGITAL.has(invById[pi.site_id]?.format)).map(pi => pi.site_id)
  )
  const physTotal    = physInv.length
  const physOccupied = physOccSet.size
  const physPct      = physTotal > 0 ? Math.round(physOccupied / physTotal * 100) : 0

  // ── My activity ──
  const myPeriod = proposals.filter(p =>
    p.created_by === userId && new Date(p.created_at) >= pS && new Date(p.created_at) <= pE
  )
  const myAcceptedIds = new Set(myPeriod.filter(p => p.status === 'accepted').map(p => p.id))
  const commPct       = userProfile?.commission_pct ?? 0
  const myCommission  = items
    .filter(pi =>
      myAcceptedIds.has(pi.proposal_id) &&
      pi.start_date && pi.end_date &&
      new Date(pi.start_date) <= pE && new Date(pi.end_date) >= pS
    )
    .reduce((s, pi) => s + (pi.rate ?? 0) * (pi.duration ?? 1) * commPct / 100, 0)

  const myFmt = {}
  items.filter(pi => myAcceptedIds.has(pi.proposal_id)).forEach(pi => {
    const fmt = invById[pi.site_id]?.format
    if (fmt) myFmt[fmt] = (myFmt[fmt] ?? 0) + 1
  })
  const topFmtKey = Object.entries(myFmt).sort(([, a], [, b]) => b - a)[0]?.[0]
  const topFormat = topFmtKey ? (FORMAT_MAP[topFmtKey]?.label ?? topFmtKey) : null

  // ── Opportunities: top 5 available physical by margin ──
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

  // ── Active campaigns: accepted proposals expiring in next 60 days ──
  const sitesPerProp = {}
  items.forEach(pi => {
    if (!sitesPerProp[pi.proposal_id]) sitesPerProp[pi.proposal_id] = new Set()
    sitesPerProp[pi.proposal_id].add(pi.site_id)
  })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const activeCampaigns = upcomingCampaigns
    .filter(p => p.valid_until)
    .map(p => ({
      id:       p.id,
      client:   p.client_name ?? '—',
      carteles: sitesPerProp[p.id]?.size ?? 0,
      startDate: p.brief_data?.startDate ?? null,
      endDate:  p.valid_until,
      daysLeft: Math.ceil((new Date(p.valid_until) - today) / 86400000),
    }))
    .filter(c => c.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8)

  return {
    revenue, prevRevenue, revDelta,
    totalProposals: periodProps.length,
    closeRate,
    weeklyData, formatMix,
    physTotal, physOccupied, physPct,
    myInCourse: myPeriod.filter(p => ['draft', 'sent'].includes(p.status)).length,
    myClosed:   myPeriod.filter(p => p.status === 'accepted').length,
    myCommission, commPct, topFormat,
    opportunities,
    activeCampaigns,
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
        .select('id, name, code, format, is_available, available_until, base_rate, cost_rent, cost_electricity, cost_taxes, cost_maintenance, cost_imponderables')
        .eq('org_id', profile.org_id),

      // 2 — Proposal items con fechas
      supabase.from('proposal_items')
        .select('site_id, proposal_id, rate, duration, start_date, end_date')
        .eq('org_id', profile.org_id),

      // 3 — Propuestas recientes (últimos 60 días, para KPIs del período)
      supabase.from('proposals')
        .select('id, status, total_value, created_by, created_at, client_name, valid_until')
        .eq('org_id', profile.org_id)
        .gte('created_at', daysAgo60.toISOString()),

      // 4 — Perfil del usuario (comisión)
      supabase.from('profiles')
        .select('commission_pct, monthly_target_ars')
        .eq('id', profile.id)
        .single(),

      // 5 — Campañas aceptadas con vencimiento en próximos 60 días
      supabase.from('proposals')
        .select('id, status, client_name, valid_until, brief_data, created_at, created_by')
        .eq('org_id', profile.org_id)
        .eq('status', 'accepted')
        .gte('valid_until', todayStr)
        .lte('valid_until', in60Str),
    ]).then(([invR, itemsR, propsR, profileR, campaignsR]) => {
      setRaw({
        inventory:         invR.data      ?? [],
        items:             itemsR.data    ?? [],
        proposals:         propsR.data    ?? [],
        userProfile:       profileR.error  ? {} : (profileR.data ?? {}),
        upcomingCampaigns: campaignsR.data ?? [],
      })
      setLoading(false)
    })
  }, [profile?.org_id, profile?.id])

  const derived = useMemo(() => {
    if (!raw || !profile?.id) return null
    return computeDerived(raw, period, profile.id)
  }, [raw, period, profile?.id])

  if (loading || !derived) {
    return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
  }

  const isCompany = isOwner || isManager

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

      {/* ── SECCIÓN 1 — Métricas empresa ── */}
      {isCompany && (
        <div>
          <SectionTitle>Métricas empresa</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

            {/* Revenue */}
            <div className="card p-4">
              <p className="text-xs text-slate-500 mb-1">Revenue período</p>
              <p className="text-xl font-bold text-white">{fmtARS(derived.revenue)}</p>
              {derived.revDelta != null ? (
                <div className={`flex items-center gap-1 mt-1.5 text-xs ${derived.revDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {derived.revDelta >= 0
                    ? <TrendingUp className="h-3 w-3" />
                    : <TrendingDown className="h-3 w-3" />}
                  <span>{derived.revDelta >= 0 ? '+' : ''}{fmtPct(derived.revDelta)} vs mes anterior</span>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-slate-600">Sin datos período anterior</p>
              )}
            </div>

            {/* Total propuestas */}
            <div className="card p-4">
              <p className="text-xs text-slate-500 mb-1">Propuestas del período</p>
              <p className="text-xl font-bold text-white">{derived.totalProposals}</p>
              <p className="mt-1.5 text-xs text-slate-600">Creadas en el mes</p>
            </div>

            {/* Tasa de cierre */}
            <div className="card p-4">
              <p className="text-xs text-slate-500 mb-1">Tasa de cierre</p>
              <p className="text-xl font-bold text-white">
                {derived.closeRate != null ? fmtPct(derived.closeRate) : '—'}
              </p>
              <p className="mt-1.5 text-xs text-slate-600">Aceptadas / enviadas + rechazadas</p>
            </div>

          </div>
        </div>
      )}

      {/* ── SECCIÓN 2 — Franja empresa ── */}
      {isCompany && (
        <div>
          <SectionTitle>Actividad del período</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-3">

            {/* A — Carteles por semana */}
            <div className="card p-4">
              <p className="mb-3 text-sm font-semibold text-white">Carteles en campaña / semana</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={derived.weeklyData} barSize={30}>
                  <XAxis
                    dataKey="semana"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false} tickLine={false}
                    allowDecimals={false}
                    width={24}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="carteles" name="Carteles" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* B — Mix de formatos */}
            <div className="card p-4">
              <p className="mb-2 text-sm font-semibold text-white">Mix de formatos vendidos</p>
              {derived.formatMix.length === 0 ? (
                <div className="flex h-[180px] items-center justify-center text-xs text-slate-600">
                  Sin datos en el período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={derived.formatMix}
                      cx="50%" cy="50%"
                      innerRadius={48} outerRadius={70}
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
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* C — Ocupación física */}
            <div className="card p-4 flex flex-col">
              <p className="mb-4 text-sm font-semibold text-white">Ocupación física</p>
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <p className="text-5xl font-bold text-white leading-none">{derived.physOccupied}</p>
                <p className="mt-2 text-sm text-slate-500">de {derived.physTotal} carteles físicos</p>
              </div>
              <div className="mt-5">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Ocupación</span>
                  <span className="font-semibold text-white">{derived.physPct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-700">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${derived.physPct}%`,
                      background: derived.physPct >= 80 ? '#22c55e'
                        : derived.physPct >= 50 ? '#f97316'
                        : '#3b82f6',
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-600">Excluye digitales y mob. digital</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── SECCIÓN 3 — Mi actividad ── */}
      <div>
        <SectionTitle>Mi actividad</SectionTitle>
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
            color="text-emerald-400" bg="bg-emerald-500/10"
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

      {/* ── SECCIÓN 4 — Oportunidades de venta ── */}
      <div>
        <SectionTitle>Oportunidades de venta</SectionTitle>
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
                      ? { label: 'Alta',   cls: 'bg-emerald-500/15 text-emerald-400' }
                      : opp.marginPct >= 40
                        ? { label: 'Buena', cls: 'bg-amber-500/15 text-amber-400' }
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
                        <td className="px-4 py-3 text-right font-semibold text-emerald-400">
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

      {/* ── SECCIÓN 5 — Campañas próximas a vencer ── */}
      <div>
        <SectionTitle>Campañas próximas a vencer</SectionTitle>
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
                        : 'bg-emerald-500/15 text-emerald-400'
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
