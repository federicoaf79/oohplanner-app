import React, { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, FileText, Target, LayoutGrid,
  ChevronDown, ChevronRight, BarChart2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { FORMAT_MAP } from '../../lib/constants'
import { useAuth } from '../../context/AuthContext'
import { calculateHistoricalCloseRate } from '../../lib/closeRate'
import {
  calculateSiteProfitability,
  calculateProposalProfitability,
  profitabilityColor,
} from '../../lib/profitability'
import Spinner from '../../components/ui/Spinner'

// ─── format helpers ──────────────────────────────────────────────────────────
function fmtARS(v) {
  if (!v && v !== 0) return '—'
  return '$' + Math.round(Number(v)).toLocaleString('es-AR')
}
function fmtPct(v) {
  if (!v && v !== 0) return '—'
  return Number(v).toFixed(1) + '%'
}
function fmtNum(v) {
  if (!v && v !== 0) return '—'
  return Math.round(Number(v)).toLocaleString('es-AR')
}

// ─── date helpers ─────────────────────────────────────────────────────────────
function getDateBounds(dateRange, customStart, customEnd) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  if (dateRange === 'current_month')
    return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59) }
  if (dateRange === 'last_month')
    return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0, 23, 59, 59) }
  if (dateRange === 'last_3_months')
    return { from: new Date(y, m - 2, 1), to: new Date(y, m + 1, 0, 23, 59, 59) }
  if (dateRange === 'last_6_months')
    return { from: new Date(y, m - 5, 1), to: new Date(y, m + 1, 0, 23, 59, 59) }
  if (dateRange === 'custom')
    return {
      from: customStart ? new Date(customStart) : null,
      to:   customEnd   ? new Date(customEnd + 'T23:59:59') : null,
    }
  return { from: null, to: null }
}

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// Trend chart — métricas seleccionables (sin verde para no chocar con el "Disponible")
const METRIC_LABELS = {
  revenue:   'Facturación',
  costs:     'Costos',
  margin:    'Margen',
  occupancy: 'Ocupación',
}
const METRIC_COLORS = {
  revenue:   '#3b82f6', // azul
  costs:     '#f59e0b', // ámbar
  margin:    '#06b6d4', // teal
  occupancy: '#a855f7', // violeta
}
const MONEY_METRICS = new Set(['revenue', 'costs', 'margin'])

const DATE_OPTS = [
  { id: 'current_month',  label: 'Mes actual' },
  { id: 'last_month',     label: 'Mes anterior' },
  { id: 'last_3_months',  label: 'Últimos 3 meses' },
  { id: 'last_6_months',  label: 'Últimos 6 meses' },
  { id: 'custom',         label: 'Personalizado' },
]

const REV_STATUSES    = new Set(['accepted'])
const ACTIVE_STATUSES = new Set(['accepted'])

// ─── tiny sub-components ─────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color = 'text-brand' }) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-surface-700 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function EmptyState({ message = 'Sin datos para el período seleccionado', hint = 'Probá con un rango de fechas más amplio.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BarChart2 className="h-10 w-10 text-slate-600 mb-3" />
      <p className="text-sm font-medium text-slate-400">{message}</p>
      <p className="text-xs text-slate-600 mt-1">{hint}</p>
    </div>
  )
}

function Section({ title, description, children }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-surface-700">
        <h3 className="font-bold text-white">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── demo data for empty chart ────────────────────────────────────────────────
const DEMO_TREND = [
  { name: 'Nov', revenue: 280000, costs: 190000, occupancy: 42, margin:  90000 },
  { name: 'Dic', revenue: 350000, costs: 200000, occupancy: 55, margin: 150000 },
  { name: 'Ene', revenue: 420000, costs: 210000, occupancy: 61, margin: 210000 },
  { name: 'Feb', revenue: 380000, costs: 205000, occupancy: 57, margin: 175000 },
  { name: 'Mar', revenue: 510000, costs: 215000, occupancy: 72, margin: 295000 },
  { name: 'Abr', revenue: 470000, costs: 220000, occupancy: 68, margin: 250000 },
]

// ─── main component ──────────────────────────────────────────────────────────
export default function Reports() {
  const { profile, isOwner, isManager } = useAuth()
  const canSeeRentabilidad = isOwner || isManager
  const orgId = profile?.org_id ?? null

  // raw data
  const [proposals, setProposals] = useState([])
  const [propItems, setPropItems] = useState([])
  const [profiles,  setProfiles]  = useState([])
  const [inventory, setInventory] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  // main tab
  const [mainTab, setMainTab] = useState('actividad')

  // filters
  const [dateRange,   setDateRange]   = useState('current_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd,   setCustomEnd]   = useState('')

  // UI state
  const [activeMetrics, setActiveMetrics] = useState(() => new Set(['revenue']))

  function toggleMetric(key) {
    setActiveMetrics(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size === 1) return prev   // mínimo 1 métrica activa
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }
  const [perfTab,     setPerfTab]     = useState('seller')
  const [expanded,    setExpanded]    = useState(new Set())

  useEffect(() => {
    if (!orgId) return
    loadAll()
  }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [
        { data: propData, error: e1 },
        { data: itemData, error: e2 },
        { data: profData, error: e3 },
        { data: invData,  error: e4 },
      ] = await Promise.all([
        supabase.from('proposals')
          .select('id, status, workflow_status, created_at, accepted_at, created_by, discount_pct, total_value, title, client_name')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false }),

        supabase.from('proposal_items')
          .select('id, proposal_id, site_id, rate, duration, start_date, end_date')
          .eq('org_id', orgId),

        supabase.from('profiles')
          .select('id, full_name, role, commission_pct, override_pct, commission_scope, monthly_target_ars')
          .eq('org_id', orgId)
          .eq('is_active', true),

        supabase.from('inventory')
          .select(`
            id, code, name, format, base_rate, is_available,
            cost_rent, cost_electricity, cost_taxes,
            cost_maintenance, cost_imponderables,
            cost_print_per_m2, cost_colocation, cost_design,
            print_width_cm, print_height_cm, width_m, height_m,
            cost_seller_commission_pct, cost_agency_commission_pct,
            cost_owner_commission_pct, cost_owner_commission,
            asociado_nombre
          `)
          .eq('org_id', orgId),
      ])

      if (e1) throw new Error(e1.message)
      if (e2) throw new Error(e2.message)
      if (e3) throw new Error(e3.message)
      if (e4) throw new Error(e4.message)

      // Build maps for JS-side joins
      const profMap = {}
      ;(profData ?? []).forEach(p => { profMap[p.id] = p })

      const invMap = {}
      ;(invData ?? []).forEach(inv => { invMap[inv.id] = inv })

      // Enrich proposals with seller name/pct
      const flatProposals = (propData ?? []).map(p => ({
        ...p,
        seller_id:             p.created_by,
        seller_name:           profMap[p.created_by]?.full_name ?? null,
        seller_commission_pct: profMap[p.created_by]?.commission_pct ?? 0,
      }))

      // Enrich proposal_items with inventory fields + client_price
      const propDiscountMap = {}
      ;(propData ?? []).forEach(p => { propDiscountMap[p.id] = p.discount_pct ?? 0 })

      const flatItems = (itemData ?? []).map(pi => {
        const inv = invMap[pi.site_id] ?? {}
        const discountPct = propDiscountMap[pi.proposal_id] ?? 0
        const clientPrice = Math.round((pi.rate ?? 0) * (1 - discountPct / 100))
        return {
          ...pi,
          discount_pct: discountPct,
          client_price: clientPrice,
          site_name: inv.name ?? null,
          site_code: inv.code ?? null,
          format:    inv.format ?? null,
          base_rate: inv.base_rate ?? null,
          cost_rent:                  inv.cost_rent ?? 0,
          cost_electricity:           inv.cost_electricity ?? 0,
          cost_taxes:                 inv.cost_taxes ?? 0,
          cost_maintenance:           inv.cost_maintenance ?? 0,
          cost_imponderables:         inv.cost_imponderables ?? 0,
          cost_print_per_m2:          inv.cost_print_per_m2 ?? 0,
          cost_seller_commission_pct: inv.cost_seller_commission_pct ?? 0,
          cost_agency_commission_pct: inv.cost_agency_commission_pct ?? 0,
          asociado_nombre:            inv.asociado_nombre ?? null,
          cost_owner_commission_pct:  inv.cost_owner_commission_pct ?? 0,
          width_m:  inv.width_m ?? 0,
          height_m: inv.height_m ?? 0,
        }
      })

      setProposals(flatProposals)
      setPropItems(flatItems)
      setProfiles(profData ?? [])
      setInventory(invData ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── filtered proposals & items ───────────────────────────────────────────
  // Filter by accepted_at (cuándo el cliente aceptó = cuándo se facturó).
  // Si no hay accepted_at, la propuesta no cuenta para el período —
  // no prorrateamos: la aceptación cae entera en su mes.
  const filteredProposals = useMemo(() => {
    const { from, to } = getDateBounds(dateRange, customStart, customEnd)
    return proposals.filter(p => {
      if (p.status !== 'accepted') return false
      if (!p.accepted_at) return false
      const acc = new Date(p.accepted_at)
      if (from && acc < from) return false
      if (to   && acc > to)   return false
      return true
    })
  }, [proposals, dateRange, customStart, customEnd])

  const filteredProposalIds = useMemo(
    () => new Set(filteredProposals.map(p => p.id)),
    [filteredProposals]
  )

  const filteredItems = useMemo(
    () => propItems.filter(pi => filteredProposalIds.has(pi.proposal_id)),
    [propItems, filteredProposalIds]
  )

  // status lookup for filtered proposals
  const filteredStatusMap = useMemo(() => {
    const map = {}
    filteredProposals.forEach(p => { map[p.id] = p.status })
    return map
  }, [filteredProposals])

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const activeIds = new Set(filteredProposals.filter(p => ACTIVE_STATUSES.has(p.status)).map(p => p.id))

    // Propuestas activas: filtradas por período
    const activeCount = filteredProposals.filter(p => p.status === 'accepted').length

    // Tasa de cierre: histórica acumulada hasta el final del rango seleccionado
    // Excluye drafts del denominador (una propuesta no enviada no es oportunidad real)
    const { from, to } = getDateBounds(dateRange, customStart, customEnd)
    const closureRateResult = calculateHistoricalCloseRate(proposals, {
      asOfDate: to ?? new Date(),
    })
    const closureRate = closureRateResult?.rate ?? 0

    // Carteles ocupados: solapamiento real con el período, solo físicos
    const DIGITAL_FORMATS = new Set(['digital', 'urban_furniture_digital'])
    const propStatusMap = {}
    proposals.forEach(p => { propStatusMap[p.id] = p.status })
    const invMap = {}
    inventory.forEach(inv => { invMap[inv.id] = inv })

    const physicalInventory = inventory.filter(inv => !DIGITAL_FORMATS.has(inv.format))

    const occupiedSiteIds = new Set(
      propItems
        .filter(pi => {
          if (!pi.start_date || !pi.end_date) return false
          if (propStatusMap[pi.proposal_id] !== 'accepted') return false
          const site = invMap[pi.site_id]
          if (!site || DIGITAL_FORMATS.has(site.format)) return false
          if (!from || !to) return true
          return new Date(pi.start_date) <= to && new Date(pi.end_date) >= from
        })
        .map(pi => pi.site_id)
    )

    const occupancyPct = physicalInventory.length > 0
      ? occupiedSiteIds.size / physicalInventory.length * 100
      : 0

    // ── Utilidad agregada del período ──
    // Sum margin/revenue per accepted proposal in the date window via the
    // shared calculateProposalProfitability helper. Fetches do NOT embed
    // the org yet (pending Block B.3), so the helper falls into backwards
    // compat mode — margin = alquiler - fijos - comisiones, without the
    // production markup lift. When B.3 lands, these numbers will rise.
    const itemsByProposalId = {}
    filteredItems.forEach(pi => {
      if (!itemsByProposalId[pi.proposal_id]) itemsByProposalId[pi.proposal_id] = []
      itemsByProposalId[pi.proposal_id].push({
        ...pi,
        site: invMap[pi.site_id] || null,
      })
    })

    let utilityMargin = 0
    let utilityRevenue = 0
    filteredProposals.forEach(p => {
      const result = calculateProposalProfitability({
        ...p,
        items: itemsByProposalId[p.id] || [],
      })
      utilityMargin  += result.margin
      utilityRevenue += result.revenue_total
    })
    const utilityPct = utilityRevenue > 0 ? (utilityMargin / utilityRevenue) * 100 : 0

    // Facturación total leída del mismo cálculo que Utilidad para que los
    // KPIs sean consistentes (rate × meses según start/end_date del item,
    // vía calculateProposalProfitability).
    const revenue = utilityRevenue

    return {
      revenue,
      activeCount,
      closureRate,
      closureRateDetail: closureRateResult,
      occupancyPct,
      physicalSiteCount: physicalInventory.length,
      occupiedCount:     occupiedSiteIds.size,
      digitalCount:      inventory.length - physicalInventory.length,
      utilityMargin,
      utilityRevenue,
      utilityPct,
    }
  }, [proposals, filteredProposals, filteredItems, propItems, inventory, dateRange, customStart, customEnd])

  // ── trend chart (always last 6 months) ───────────────────────────────────
  // Facturación / costos / margen se anclan en accepted_at — mismo modelo
  // que el KPI "Facturación total" para que un mismo mes muestre el mismo
  // número en ambos lugares (via calculateProposalProfitability).
  // Ocupación se mantiene en overlap de fechas (operativa, no comercial).
  const trendData = useMemo(() => {
    const now = new Date()
    const DIGITAL_FORMATS = new Set(['digital', 'urban_furniture_digital'])

    const invById = {}
    inventory.forEach(inv => { invById[inv.id] = inv })

    const propStatusMap = {}
    proposals.forEach(p => { propStatusMap[p.id] = p.status })

    const acceptedProposals = proposals.filter(p => p.status === 'accepted')

    // Items agrupados por proposal (para no recorrer N×M veces)
    const itemsByProposal = {}
    propItems.forEach(pi => {
      if (!itemsByProposal[pi.proposal_id]) itemsByProposal[pi.proposal_id] = []
      itemsByProposal[pi.proposal_id].push(pi)
    })

    const physicalTotal = inventory.filter(inv => !DIGITAL_FORMATS.has(inv.format)).length

    return Array.from({ length: 6 }, (_, i) => {
      const d          = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)

      // Facturación / costos / margen: por accepted_at del mes
      let revenue = 0, costs = 0, margin = 0
      acceptedProposals.forEach(p => {
        if (!p.accepted_at) return
        const acc = new Date(p.accepted_at)
        if (acc < monthStart || acc > monthEnd) return
        const items = (itemsByProposal[p.id] ?? []).map(pi => ({
          ...pi,
          site: invById[pi.site_id] || null,
        }))
        const result = calculateProposalProfitability({ ...p, items })
        revenue += result.revenue_total
        costs   += result.cost_total
        margin  += result.margin
      })

      // Ocupación: solapamiento real de campaña con el mes (solo físicos)
      const occupiedInMonth = new Set(
        propItems.filter(pi => {
          if (!pi.start_date || !pi.end_date) return false
          const site = invById[pi.site_id]
          if (!site || DIGITAL_FORMATS.has(site.format)) return false
          if (propStatusMap[pi.proposal_id] !== 'accepted') return false
          return new Date(pi.start_date) <= monthEnd && new Date(pi.end_date) >= monthStart
        }).map(pi => pi.site_id)
      )
      const occupancy = physicalTotal > 0
        ? Math.round(occupiedInMonth.size / physicalTotal * 100)
        : 0

      return {
        name: MONTH_LABELS[d.getMonth()],
        revenue, costs, margin, occupancy,
      }
    })
  }, [proposals, propItems, inventory])

  const hasRealTrend = trendData.some(d => d.revenue > 0 || d.occupancy > 0)
  const chartData    = hasRealTrend ? trendData : DEMO_TREND

  // ── seller performance ────────────────────────────────────────────────────
  const sellerPerf = useMemo(() => {
    const map = {}

    filteredProposals.forEach(p => {
      // Excluir drafts: no son oportunidades reales
      if (p.status === 'draft') return

      const sid = p.seller_id ?? '__none__'
      if (!map[sid]) {
        const prof = profiles.find(pr => pr.id === sid)
        map[sid] = {
          sellerId: sid,
          name:     p.seller_name ?? 'Sin asignar',
          commPct:  p.seller_commission_pct ?? 0,
          target:   prof?.monthly_target_ars ?? null,
          proposals: 0,
          won:       0,
          revenue:   0,
        }
      }
      map[sid].proposals++
      if (p.status === 'accepted') map[sid].won++
      if (REV_STATUSES.has(p.status)) {
        map[sid].revenue += filteredItems
          .filter(pi => pi.proposal_id === p.id)
          .reduce((s, pi) => s + (pi.client_price ?? pi.rate ?? 0), 0)
      }
    })

    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [filteredProposals, filteredItems, profiles])

  // ── format performance ────────────────────────────────────────────────────
  const formatPerf = useMemo(() => {
    const map = {}
    inventory.forEach(inv => {
      const fmt = inv.format ?? '__none__'
      if (!map[fmt]) map[fmt] = { format: inv.format, total: 0, occupied: new Set(), revenue: 0 }
      map[fmt].total++
    })

    filteredProposals.forEach(p => {
      filteredItems.filter(pi => pi.proposal_id === p.id).forEach(pi => {
        const fmt = pi.format ?? '__none__'
        if (!map[fmt]) return
        if (ACTIVE_STATUSES.has(p.status)) map[fmt].occupied.add(pi.site_id)
        if (REV_STATUSES.has(p.status))    map[fmt].revenue += (pi.client_price ?? pi.rate ?? 0)
      })
    })

    return Object.values(map)
      .map(d => ({
        format:        d.format,
        total:         d.total,
        occupiedCount: d.occupied.size,
        occupancyPct:  d.total > 0 ? d.occupied.size / d.total * 100 : 0,
        revenue:       d.revenue,
        avgRevenue:    d.occupied.size > 0 ? d.revenue / d.occupied.size : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [inventory, filteredProposals, filteredItems])

  // ── profitability per site ────────────────────────────────────────────────
  // Per-site profitability — aggregated across revenue-producing items via
  // the shared calculateSiteProfitability helper. Now includes cost_colocation
  // + cost_design + full owner commission (previously omitted).
  const siteProfit = useMemo(() => {
    // Estado de ocupación: contra HOY, no contra el filtro de período. Un cartel
    // está ocupado hoy si hay al menos un proposal_item con workflow_status
    // active/approved/printing y rango de fechas que abarca la fecha actual.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const ACTIVE_WORKFLOWS = new Set(['active', 'approved', 'printing'])
    const propById = {}
    proposals.forEach(p => { propById[p.id] = p })

    return inventory.map(inv => {
      const siteItems = filteredItems.filter(pi => pi.site_id === inv.id)
      const revItems  = siteItems.filter(pi => REV_STATUSES.has(filteredStatusMap[pi.proposal_id]))

      // Búsqueda de campaña activa HOY sobre el dataset completo (propItems),
      // independiente del filtro de período del usuario.
      const activeCampaign = propItems.find(pi => {
        if (pi.site_id !== inv.id) return false
        const prop = propById[pi.proposal_id]
        if (!prop) return false
        if (!ACTIVE_WORKFLOWS.has(prop.workflow_status)) return false
        const start = pi.start_date ? new Date(pi.start_date) : null
        const end   = pi.end_date   ? new Date(pi.end_date)   : null
        const startOk = !start || start <= today
        const endOk   = !end   || end   >= today
        return startOk && endOk
      })
      const isOccupied = !!activeCampaign

      // Aggregate profitability per item using the shared helper.
      const agg = revItems.reduce((acc, pi) => {
        const months = Number(pi.duration) || 1
        const result = calculateSiteProfitability(inv, {
          months,
          itemRate:   pi.rate,
          discountPct: pi.discount_pct ?? 0,
        })
        if (!result) return acc
        acc.revenue    += result.revenue_net
        acc.fixedCosts += result.costs.fixed_prorated
        acc.printCost  += result.costs.print
        acc.colocation += result.costs.colocation
        acc.design     += result.costs.design
        acc.sellerComm += result.costs.seller_commission
        acc.agencyComm += result.costs.agency_commission
        acc.ownerComm  += result.costs.owner_commission
        return acc
      }, {
        revenue: 0, fixedCosts: 0, printCost: 0, colocation: 0, design: 0,
        sellerComm: 0, agencyComm: 0, ownerComm: 0,
      })

      const totalCosts = agg.fixedCosts + agg.printCost + agg.colocation + agg.design
      const totalComm  = agg.sellerComm + agg.agencyComm + agg.ownerComm
      const netProfit  = agg.revenue - totalCosts - totalComm
      const roi        = totalCosts > 0 ? netProfit / totalCosts * 100 : null
      const margin     = agg.revenue > 0 ? netProfit / agg.revenue * 100 : null

      // Display percentages — from inv (current config), not frozen on items.
      const sellerPct = inv.cost_seller_commission_pct ?? 0
      const agencyPct = inv.cost_agency_commission_pct ?? 0
      const ownerPct  = inv.cost_owner_commission_pct ?? 0

      return {
        ...inv,
        revenue: agg.revenue,
        fixedCosts: agg.fixedCosts,
        printCost: agg.printCost,
        totalCosts,
        sellerPct,
        agencyPct,
        asociPct:  ownerPct,                          // UI backwards-compat key
        asociName: inv.asociado_nombre ?? null,
        sellerComm: agg.sellerComm,
        agencyComm: agg.agencyComm,
        asociComm:  agg.ownerComm,                    // UI backwards-compat key
        totalComm,
        netProfit, roi, margin, isOccupied,
        activeCampaign,   // para mostrar fechas en la columna Estado
      }
    }).sort((a, b) => b.revenue - a.revenue)
  }, [inventory, filteredItems, filteredStatusMap, propItems, proposals])

  // ── chart formatters ──────────────────────────────────────────────────────
  // Eje Y izquierdo (moneda): abreviado a M/K
  function moneyAxisFormatter(value) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000)     return `$${(value / 1_000).toFixed(0)}K`
    return fmtARS(value)
  }
  // Eje Y derecho (porcentaje)
  function pctAxisFormatter(value) {
    return `${Math.round(value)}%`
  }
  // Tooltip por métrica (se decide por el `name` del Line, que es el label)
  function tooltipFormatter(value, name) {
    if (name === METRIC_LABELS.occupancy) return [fmtPct(value), name]
    return [fmtARS(value), name]
  }

  function toggleExpanded(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {error}
      </div>
    )
  }

  const hasData = filteredProposals.length > 0

  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold text-white">Reportes</h2>
        <p className="text-sm text-slate-500">Business intelligence de tu operación OOH</p>
      </div>

      {/* ── Pestañas principales ─────────────────────────────────────────── */}
      <div className="flex border-b border-surface-700 gap-1">
        {[
          { id: 'actividad',    label: 'Mi actividad',  show: true },
          { id: 'rentabilidad', label: 'Rentabilidad',  show: canSeeRentabilidad },
          { id: 'audiencias',   label: 'Audiencias',    show: true },
        ].filter(t => t.show).map(t => (
          <button
            key={t.id}
            onClick={() => setMainTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              mainTab === t.id
                ? 'border-brand text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: MI ACTIVIDAD ────────────────────────────────────────────── */}
      {mainTab === 'actividad' && (<>

      {/* date filter */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {DATE_OPTS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setDateRange(opt.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                dateRange === opt.id
                  ? 'bg-brand text-white'
                  : 'bg-surface-700 text-slate-400 hover:text-white hover:bg-surface-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {dateRange === 'custom' && (
          <div className="flex items-center gap-3 mt-3">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input-field text-xs py-1.5 w-36" />
            <span className="text-slate-500 text-xs">a</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input-field text-xs py-1.5 w-36" />
          </div>
        )}
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          icon={TrendingUp}
          label="Facturación total"
          value={fmtARS(kpis.revenue)}
          sub="Propuestas aceptadas en el período"
        />
        <KPICard
          icon={FileText}
          label="Propuestas aceptadas"
          value={fmtNum(kpis.activeCount)}
          sub="Aceptadas en el período"
          color="text-teal-400"
        />
        <KPICard
          icon={Target}
          label="Tasa de cierre"
          value={kpis.closureRateDetail != null ? fmtPct(kpis.closureRate) : '—'}
          sub={kpis.closureRateDetail != null
            ? `${kpis.closureRateDetail.won} / ${kpis.closureRateDetail.total} acumulado`
            : 'Sin histórico todavía'}
          color="text-amber-400"
        />
        <KPICard
          icon={LayoutGrid}
          label="Ocupación física"
          value={fmtPct(kpis.occupancyPct)}
          sub={
            <>
              {kpis.occupiedCount} de {kpis.physicalSiteCount} carteles físicos ocupados
              <span className="block mt-0.5 text-[10px] text-slate-600">
                {kpis.digitalCount} digitales siempre disponibles
              </span>
            </>
          }
          color="text-cyan-400"
        />
        <KPICard
          icon={TrendingUp}
          label="Utilidad del período"
          value={fmtARS(kpis.utilityMargin)}
          sub={
            <>
              <span className={
                (() => {
                  const c = profitabilityColor(kpis.utilityPct)
                  if (c === 'brand') return 'text-brand'
                  if (c === 'teal')  return 'text-teal-400'
                  if (c === 'amber') return 'text-amber-400'
                  return 'text-rose-400'
                })()
              }>
                {fmtPct(kpis.utilityPct)} margen
              </span>
              <span className="block mt-0.5 text-[10px] text-slate-600">
                Sobre {fmtARS(kpis.utilityRevenue)} facturados
              </span>
            </>
          }
          color="text-teal-400"
        />
      </div>

      {/* ── Block 1 — Trend chart ─────────────────────────────────────────── */}
      <Section
        title="Evolución de tendencia"
        description="Últimos 6 meses"
      >
        {/* metric pills — selección múltiple, mínimo 1 activa */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {['revenue', 'costs', 'margin', 'occupancy'].map(key => {
            const active = activeMetrics.has(key)
            const color  = METRIC_COLORS[key]
            return (
              <button
                key={key}
                onClick={() => toggleMetric(key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border text-white'
                    : 'border border-transparent bg-surface-700 text-slate-400 hover:text-white'
                }`}
                style={active ? { backgroundColor: `${color}33`, borderColor: color } : undefined}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                {METRIC_LABELS[key]}
              </button>
            )
          })}
          {!hasRealTrend && (
            <span className="ml-auto text-xs text-slate-600 border border-surface-600 rounded px-2 py-0.5">
              Demo
            </span>
          )}
        </div>

        <div className="relative">
          {!hasRealTrend && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <span className="text-[80px] font-black text-white/[0.035] select-none uppercase tracking-widest">
                Demo
              </span>
            </div>
          )}
          {(() => {
            const hasMoney = ['revenue', 'costs', 'margin'].some(k => activeMetrics.has(k))
            const hasPct   = activeMetrics.has('occupancy')
            return (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: hasPct && hasMoney ? 8 : 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  {hasMoney && (
                    <YAxis
                      yAxisId="money"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={moneyAxisFormatter}
                      width={68}
                    />
                  )}
                  {hasPct && (
                    <YAxis
                      yAxisId="pct"
                      orientation="right"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={pctAxisFormatter}
                      domain={[0, 100]}
                      width={40}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      color: '#f1f5f9',
                      fontSize: 12,
                    }}
                    formatter={tooltipFormatter}
                  />
                  {[...activeMetrics].map(key => (
                    <Line
                      key={key}
                      yAxisId={MONEY_METRICS.has(key) ? 'money' : 'pct'}
                      type="monotone"
                      dataKey={key}
                      name={METRIC_LABELS[key]}
                      stroke={METRIC_COLORS[key]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: METRIC_COLORS[key] }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )
          })()}
        </div>
      </Section>

      {/* ── Block 2 — Commercial performance ─────────────────────────────── */}
      <Section
        title="Performance comercial"
        description="Desglose por vendedor y formato de cartel"
      >
        {/* tabs */}
        <div className="flex gap-1 mb-5 border-b border-surface-700">
          {[
            { id: 'seller', label: 'Por vendedor' },
            { id: 'format', label: 'Por formato' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setPerfTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                perfTab === t.id
                  ? 'border-brand text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!hasData && <EmptyState />}

        {/* Tab: por vendedor */}
        {hasData && perfTab === 'seller' && (
          sellerPerf.length === 0 ? <EmptyState /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-surface-700">
                    <th className="text-left pb-3 font-medium">Vendedor</th>
                    <th className="text-right pb-3 font-medium">Propuestas</th>
                    <th className="text-right pb-3 font-medium">Facturación</th>
                    <th className="text-left pb-3 font-medium px-4">vs Target</th>
                    <th className="text-right pb-3 font-medium">Comisión est.</th>
                    <th className="text-right pb-3 font-medium">Tasa cierre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/50">
                  {sellerPerf.map(s => {
                    const closure    = s.proposals > 0 ? s.won / s.proposals * 100 : 0
                    const commission = s.revenue * s.commPct / 100
                    const targetPct  = s.target > 0 ? Math.min(s.revenue / s.target * 100, 100) : null
                    return (
                      <tr key={s.sellerId} className="hover:bg-surface-800/50 transition-colors">
                        <td className="py-3 font-medium text-white">{s.name}</td>
                        <td className="py-3 text-right text-slate-300">{s.proposals}</td>
                        <td className="py-3 text-right text-white font-medium">{fmtARS(s.revenue)}</td>
                        <td className="py-3 px-4 min-w-[120px]">
                          {targetPct !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    targetPct >= 100 ? 'bg-teal-500' :
                                    targetPct >= 60  ? 'bg-amber-400' : 'bg-red-400'
                                  }`}
                                  style={{ width: `${targetPct}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-400 shrink-0 w-8 text-right">
                                {Math.round(targetPct)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-600">Sin target</span>
                          )}
                        </td>
                        <td className="py-3 text-right text-slate-300">{fmtARS(commission)}</td>
                        <td className="py-3 text-right">
                          <span className={`font-medium ${
                            closure >= 50 ? 'text-teal-400' :
                            closure >= 25 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {fmtPct(closure)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Tab: por formato */}
        {hasData && perfTab === 'format' && (
          formatPerf.length === 0 ? <EmptyState /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-surface-700">
                    <th className="text-left pb-3 font-medium">Formato</th>
                    <th className="text-right pb-3 font-medium">Carteles</th>
                    <th className="text-right pb-3 font-medium">Ocupados</th>
                    <th className="text-right pb-3 font-medium">% Ocupación</th>
                    <th className="text-right pb-3 font-medium">Facturación</th>
                    <th className="text-right pb-3 font-medium">Facturación prom.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/50">
                  {formatPerf.map(f => (
                    <tr key={f.format ?? '__none__'} className="hover:bg-surface-800/50 transition-colors">
                      <td className="py-3 font-medium text-white">{FORMAT_MAP[f.format]?.label ?? f.format ?? '—'}</td>
                      <td className="py-3 text-right text-slate-300">{f.total}</td>
                      <td className="py-3 text-right text-slate-300">{f.occupiedCount}</td>
                      <td className="py-3 text-right">
                        <span className={`font-medium ${
                          f.occupancyPct >= 70 ? 'text-teal-400' :
                          f.occupancyPct >= 40 ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                          {fmtPct(f.occupancyPct)}
                        </span>
                      </td>
                      <td className="py-3 text-right text-white font-medium">{fmtARS(f.revenue)}</td>
                      <td className="py-3 text-right text-slate-300">{fmtARS(f.avgRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Section>

      {/* ── Block 3 — Profitability per site ─────────────────────────────── */}
      <Section
        title="Rentabilidad por cartel"
        description="Hacé clic en una fila para ver el desglose de ingresos, costos y comisiones"
      >
        {inventory.length === 0 ? (
          <EmptyState
            message="No hay carteles en el inventario."
            hint="Agregá carteles desde la sección Inventario."
          />
        ) : (
          <div className="overflow-x-auto">
            <p className="text-xs text-slate-500 mb-2 text-right">
              Estado de ocupación al {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-surface-700">
                  <th className="w-6 pb-3" />
                  <th className="text-left pb-3 font-medium">Cartel</th>
                  <th className="text-left pb-3 font-medium hidden sm:table-cell">Formato</th>
                  <th className="text-right pb-3 font-medium">Facturación período</th>
                  <th className="text-right pb-3 font-medium hidden md:table-cell">Costos/mes</th>
                  <th className="text-right pb-3 font-medium">Margen</th>
                  <th className="text-right pb-3 font-medium hidden lg:table-cell">Estado</th>
                </tr>
              </thead>
              <tbody>
                {siteProfit.map(site => {
                  const isOpen = expanded.has(site.id)
                  return (
                    <React.Fragment key={site.id}>
                      {/* main row */}
                      <tr
                        onClick={() => toggleExpanded(site.id)}
                        className="border-b border-surface-700/40 hover:bg-surface-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 pr-2 pl-1">
                          {isOpen
                            ? <ChevronDown  className="h-3.5 w-3.5 text-slate-500" />
                            : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                          }
                        </td>
                        <td className="py-3">
                          <p className="font-medium text-white text-sm">{site.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{site.code}</p>
                        </td>
                        <td className="py-3 text-slate-400 capitalize hidden sm:table-cell">
                          {FORMAT_MAP[site.format]?.label ?? site.format ?? '—'}
                        </td>
                        <td className="py-3 text-right font-medium text-white">
                          {site.revenue === 0 && site.isOccupied ? (
                            <span
                              className="text-slate-600 text-xs"
                              title="Campaña vendida en otro período — sigue ocupado pero no facturó dentro del rango seleccionado"
                            >
                              Período anterior
                            </span>
                          ) : (
                            fmtARS(site.revenue)
                          )}
                        </td>
                        <td className="py-3 text-right text-slate-400 hidden md:table-cell">
                          {site.revenue === 0 && site.isOccupied
                            ? <span className="text-slate-600">—</span>
                            : fmtARS(site.totalCosts)}
                        </td>
                        <td className="py-3 text-right">
                          {site.margin !== null ? (
                            <span className={`font-medium ${
                              site.margin >= 50 ? 'text-teal-400' :
                              site.margin >= 20 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {fmtPct(site.margin)}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right hidden lg:table-cell">
                          {(() => {
                            if (!site.isOccupied) {
                              return <span className="text-xs text-teal-400 font-medium">Disponible</span>
                            }
                            const c = site.activeCampaign
                            const fmt = d => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

                            let daysLeft = null
                            if (c?.end_date) {
                              const today = new Date()
                              today.setHours(0, 0, 0, 0)
                              const endDate = new Date(c.end_date)
                              endDate.setHours(0, 0, 0, 0)
                              daysLeft = Math.round((endDate - today) / 86400000)
                            }
                            const showSoon = daysLeft !== null && daysLeft <= 7
                            const soonLabel =
                              daysLeft === 0 ? 'Disponible mañana'
                              : `Disponible en ${daysLeft} día${daysLeft > 1 ? 's' : ''}`

                            return (
                              <div className="text-right">
                                <span className="text-xs text-amber-400 font-medium block">Ocupado</span>
                                {c?.start_date && c?.end_date && (
                                  <span className="text-[10px] text-slate-500">{fmt(c.start_date)} → {fmt(c.end_date)}</span>
                                )}
                                {showSoon && (
                                  <span className="text-[10px] text-amber-300 block mt-0.5">
                                    {soonLabel}
                                    <span className="text-slate-600"> · salvo renovación</span>
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                      </tr>

                      {/* expanded detail */}
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="px-2 py-4 bg-surface-900/60 border-b border-surface-700/40">
                            <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                              {/* Ingresos */}
                              <div className="rounded-xl border border-surface-700 bg-surface-800 p-4 space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                                  Ingresos
                                </p>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-400">Facturación período</span>
                                  <span className="text-white font-medium">{fmtARS(site.revenue)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-400">Tarifa base mensual</span>
                                  <span className="text-slate-300">{fmtARS(site.base_rate)}</span>
                                </div>
                              </div>

                              {/* Costos fijos */}
                              <div className="rounded-xl border border-surface-700 bg-surface-800 p-4 space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                                  Costos fijos / mes
                                </p>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-400">Alquiler</span>
                                  <span className="text-slate-300">{fmtARS(site.cost_rent)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-400">Luz</span>
                                  <span className="text-slate-300">{fmtARS(site.cost_electricity)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-400">Impuestos</span>
                                  <span className="text-slate-300">{fmtARS(site.cost_taxes)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-400">Mantenimiento</span>
                                  <span className="text-slate-300">{fmtARS(site.cost_maintenance)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-400">Imponderables</span>
                                  <span className="text-slate-300">{fmtARS(site.cost_imponderables)}</span>
                                </div>
                                {site.printCost > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Impresión</span>
                                    <span className="text-slate-300">{fmtARS(site.printCost)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm pt-2 border-t border-surface-700 font-medium">
                                  <span className="text-slate-300">Total costos</span>
                                  <span className="text-white">{fmtARS(site.totalCosts)}</span>
                                </div>
                              </div>

                              {/* Comisiones */}
                              <div className="rounded-xl border border-surface-700 bg-surface-800 p-4 space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                                  Comisiones pagadas
                                </p>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-400">Vendedor ({fmtPct(site.sellerPct)})</span>
                                  <span className="text-slate-300">{fmtARS(site.sellerComm)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-400">Agencia ({fmtPct(site.agencyPct)})</span>
                                  <span className="text-slate-300">{fmtARS(site.agencyComm)}</span>
                                </div>
                                {site.asociPct > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">
                                      {site.asociName ?? 'Asociado'} ({fmtPct(site.asociPct)})
                                    </span>
                                    <span className="text-slate-300">{fmtARS(site.asociComm)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm pt-2 border-t border-surface-700 font-medium">
                                  <span className="text-slate-300">Total comisiones</span>
                                  <span className="text-white">{fmtARS(site.totalComm)}</span>
                                </div>
                              </div>

                              {/* Resultado */}
                              <div className="rounded-xl border border-surface-700 bg-surface-800 p-4 space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                                  Resultado
                                </p>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-400">Ingreso bruto</span>
                                  <span className="text-slate-300">{fmtARS(site.revenue)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-400">Total costos</span>
                                  <span className="text-slate-300">− {fmtARS(site.totalCosts)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-400">Total comisiones</span>
                                  <span className="text-slate-300">− {fmtARS(site.totalComm)}</span>
                                </div>
                                <div className={`flex justify-between text-sm pt-2 border-t border-surface-700 font-bold ${
                                  site.netProfit >= 0 ? 'text-teal-400' : 'text-red-400'
                                }`}>
                                  <span>Utilidad neta</span>
                                  <span>{fmtARS(site.netProfit)}</span>
                                </div>
                                {site.roi !== null && (
                                  <div className={`flex justify-between text-sm font-medium ${
                                    site.roi >= 0 ? 'text-teal-400/80' : 'text-red-400/80'
                                  }`}>
                                    <span>ROI</span>
                                    <span>{fmtPct(site.roi)}</span>
                                  </div>
                                )}
                              </div>

                            </div>

                            {/* Historial de ocupación */}
                            {(() => {
                              const { from, to } = getDateBounds(dateRange, customStart, customEnd)
                              const filterFrom = from ?? new Date(0)
                              const filterTo   = to   ?? new Date()

                              const propStatusLookup = {}
                              const propTitleLookup  = {}
                              const propClientLookup = {}
                              proposals.forEach(p => {
                                propStatusLookup[p.id] = p.status
                                propTitleLookup[p.id]  = p.title ?? 'Sin nombre'
                                propClientLookup[p.id] = p.client_name ?? ''
                              })

                              const campaigns = propItems
                                .filter(pi => {
                                  if (pi.site_id !== site.id) return false
                                  if (!pi.start_date || !pi.end_date) return false
                                  const piStart = new Date(pi.start_date)
                                  const piEnd   = new Date(pi.end_date)
                                  return piStart <= filterTo && piEnd >= filterFrom &&
                                    propStatusLookup[pi.proposal_id] === 'accepted'
                                })
                                .map(pi => ({
                                  ...pi,
                                  proposalTitle: propTitleLookup[pi.proposal_id],
                                  clientName:    propClientLookup[pi.proposal_id],
                                }))

                              // Meses del período
                              const months = []
                              const cursor = new Date(filterFrom.getFullYear(), filterFrom.getMonth(), 1)
                              const endCursor = new Date(filterTo.getFullYear(), filterTo.getMonth(), 1)
                              while (cursor <= endCursor) {
                                const mStart = new Date(cursor)
                                const mEnd   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
                                const isOccupied = campaigns.some(pi => {
                                  const s = new Date(pi.start_date)
                                  const e = new Date(pi.end_date)
                                  return s <= mEnd && e >= mStart
                                })
                                months.push({
                                  label: cursor.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
                                  occupied: isOccupied,
                                })
                                cursor.setMonth(cursor.getMonth() + 1)
                              }

                              const occupiedMonths = months.filter(m => m.occupied).length
                              const occupancyPct   = months.length > 0
                                ? Math.round(occupiedMonths / months.length * 100)
                                : 0
                              const fmtDate = d => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

                              return (
                                <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4">
                                  <p className="text-xs font-semibold text-slate-300 mb-3">
                                    Historial de ocupación — {occupiedMonths}/{months.length} meses ({occupancyPct}%)
                                  </p>

                                  <div className="flex flex-wrap gap-1.5 mb-3">
                                    {months.map((m, i) => (
                                      <span key={i} className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                                        m.occupied
                                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                          : 'bg-surface-700 text-slate-600 border-surface-600'
                                      }`}>
                                        {m.label}
                                      </span>
                                    ))}
                                  </div>

                                  {campaigns.length > 0 ? (
                                    <div className="space-y-1.5 border-t border-surface-700 pt-3">
                                      <p className="text-[10px] text-slate-500 font-medium mb-1">Campañas en el período:</p>
                                      {campaigns.map((c, i) => (
                                        <div key={i} className="flex items-center justify-between text-[10px]">
                                          <span className="text-slate-400 truncate max-w-[60%]">
                                            {c.proposalTitle}{c.clientName ? ` — ${c.clientName}` : ''}
                                          </span>
                                          <span className="text-slate-500 shrink-0 ml-2">
                                            {fmtDate(c.start_date)} → {fmtDate(c.end_date)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-600">Sin campañas en este período</p>
                                  )}
                                </div>
                              )
                            })()}

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {kpis.utilityRevenue > 0 && (
          <div className="mt-5 rounded-xl bg-slate-800/50 border border-surface-700 px-4 py-3 text-center">
            <p className="text-xs text-slate-400">
              Total consolidado del período:{' '}
              <span className="font-semibold text-white">{fmtARS(kpis.utilityMargin)}</span>
              {' '}de utilidad sobre{' '}
              <span className="font-semibold text-white">{fmtARS(kpis.utilityRevenue)}</span>
              {' '}facturados{' '}
              <span className={
                (() => {
                  const c = profitabilityColor(kpis.utilityPct)
                  if (c === 'brand') return 'text-brand'
                  if (c === 'teal')  return 'text-teal-400'
                  if (c === 'amber') return 'text-amber-400'
                  return 'text-rose-400'
                })()
              }>
                ({fmtPct(kpis.utilityPct)} margen)
              </span>
            </p>
          </div>
        )}
      </Section>

      </>) /* fin tab actividad */}

      {/* ── TAB: RENTABILIDAD ────────────────────────────────────────────── */}
      {mainTab === 'rentabilidad' && canSeeRentabilidad && (
        <div className="space-y-6">

          <Section title="Top 5 — Carteles más rentables">
            <div className="overflow-x-auto rounded-xl border border-surface-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700 bg-surface-800/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Cartel</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Facturación</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700">
                  {(() => {
                    const siteMap = {}
                    acceptedProposals.forEach(p => {
                      ;(p.proposal_items ?? []).forEach(pi => {
                        if (!pi.site_id) return
                        const inv = inventory.find(i => i.id === pi.site_id)
                        if (!inv) return
                        const rate = pi.rate ?? inv.base_rate ?? 0
                        const disc = pi.discount_pct ?? p.discount_pct ?? 0
                        const rev = rate * (1 - disc / 100)
                        const res = calculateSiteProfitability(inv, p, orgConfig)
                        if (!siteMap[pi.site_id]) siteMap[pi.site_id] = { revenue: 0, costs: 0, name: inv.name }
                        siteMap[pi.site_id].revenue += rev
                        siteMap[pi.site_id].costs += (res?.costs ?? 0)
                      })
                    })
                    return Object.entries(siteMap)
                      .map(([id, s]) => ({ id, ...s, margin: s.revenue > 0 ? (s.revenue - s.costs) / s.revenue * 100 : 0 }))
                      .sort((a, b) => b.margin - a.margin)
                      .slice(0, 5)
                      .map((s, i) => (
                        <tr key={s.id} className="hover:bg-surface-800/40">
                          <td className="px-4 py-3 text-slate-500 text-xs">{i + 1}</td>
                          <td className="px-4 py-3 text-slate-200 font-medium">{s.name}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{fmtARS(s.revenue)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={s.margin >= 40 ? 'text-brand font-semibold' : s.margin >= 20 ? 'text-amber-400' : 'text-rose-400'}>
                              {fmtPct(s.margin)}
                            </span>
                          </td>
                        </tr>
                      ))
                  })()}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Rentabilidad por cliente — Top 10">
            <div className="overflow-x-auto rounded-xl border border-surface-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700 bg-surface-800/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Cliente</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Campañas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Facturación</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Última campaña</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700">
                  {(() => {
                    const clientMap = {}
                    acceptedProposals.forEach(p => {
                      const key = p.client_name ?? 'Sin nombre'
                      if (!clientMap[key]) clientMap[key] = { count: 0, revenue: 0, lastDate: '' }
                      clientMap[key].count++
                      clientMap[key].revenue += p.total_value ?? 0
                      const d = p.accepted_at ?? p.created_at ?? ''
                      if (d > clientMap[key].lastDate) clientMap[key].lastDate = d
                    })
                    return Object.entries(clientMap)
                      .sort((a, b) => b[1].revenue - a[1].revenue)
                      .slice(0, 10)
                      .map(([name, c]) => (
                        <tr key={name} className="hover:bg-surface-800/40">
                          <td className="px-4 py-3 text-slate-200 font-medium">{name}</td>
                          <td className="px-4 py-3 text-right text-slate-400">{c.count}</td>
                          <td className="px-4 py-3 text-right text-slate-300 font-semibold">{fmtARS(c.revenue)}</td>
                          <td className="px-4 py-3 text-right text-slate-500 text-xs">
                            {c.lastDate ? new Date(c.lastDate).toLocaleDateString('es-AR') : '—'}
                          </td>
                        </tr>
                      ))
                  })()}
                </tbody>
              </table>
            </div>
          </Section>

        </div>
      )}

      {/* ── TAB: AUDIENCIAS ──────────────────────────────────────────────── */}
      {mainTab === 'audiencias' && (
        <div className="space-y-6">

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Carteles con tráfico', value: inventory.filter(i => i.daily_traffic > 0).length, sub: `de ${inventory.length} totales`, color: 'text-brand' },
              { label: 'Tráfico diario total', value: fmtNum(inventory.reduce((s, i) => s + (i.daily_traffic ?? 0), 0)), sub: 'vehículos/personas por día', color: 'text-cyan-400' },
              { label: 'Impactos mensuales', value: fmtNum(inventory.reduce((s, i) => s + (i.daily_traffic ?? 0) * 30, 0)), sub: 'estimados (x30 días)', color: 'text-teal-400' },
              { label: 'Datos oficiales', value: inventory.filter(i => i.audience_source === 'oficial').length, sub: 'carteles con fuente verificada', color: 'text-amber-400' },
            ].map((k, i) => (
              <div key={i} className="card p-4">
                <p className="text-xs text-slate-500">{k.label}</p>
                <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                <p className="text-xs text-slate-600 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          <Section title="Top carteles por tráfico diario">
            <div className="overflow-x-auto rounded-xl border border-surface-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700 bg-surface-800/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Cartel</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 hidden sm:table-cell">Ciudad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Tráfico/día</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Impactos/mes</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 hidden md:table-cell">Fuente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700">
                  {[...inventory]
                    .filter(i => i.daily_traffic > 0)
                    .sort((a, b) => (b.daily_traffic ?? 0) - (a.daily_traffic ?? 0))
                    .slice(0, 15)
                    .map((site, idx) => (
                      <tr key={site.id} className="hover:bg-surface-800/40">
                        <td className="px-4 py-3 text-slate-500 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 text-slate-200 font-medium">
                          <p className="truncate max-w-[180px]">{site.name}</p>
                          <p className="text-xs text-slate-500">{site.code}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-400 hidden sm:table-cell text-xs">{site.city}</td>
                        <td className="px-4 py-3 text-right text-brand font-semibold">{fmtNum(site.daily_traffic)}</td>
                        <td className="px-4 py-3 text-right text-slate-400">{fmtNum((site.daily_traffic ?? 0) * 30)}</td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className={`text-xs rounded-full px-2 py-0.5 ${site.audience_source === 'oficial' ? 'bg-brand/10 text-brand' : 'bg-surface-700 text-slate-500'}`}>
                            {site.audience_source === 'oficial' ? 'Oficial' : site.audience_source ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-600 mt-3">
              Fuentes: Flujo Vehicular Anillo Digital · data.buenosaires.gob.ar (CC Attribution) ·
              TMDA Dirección Nacional de Vialidad · datos.transporte.gob.ar
            </p>
          </Section>

        </div>
      )}

    </div>
  )
}