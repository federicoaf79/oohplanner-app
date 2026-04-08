import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Megaphone, MapPin, FileText, TrendingUp, ArrowRight,
  Users, ChevronDown, ChevronUp, Shield, DollarSign,
  BarChart2, Target
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'
import { FORMAT_MAP } from '../../lib/constants'

// ── Helpers ───────────────────────────────────────────────────

function monthRange(offset = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
  const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
  return { start, end }
}

function sixMonthsAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 5)
  d.setDate(1)
  return d.toISOString()
}

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function getMonthKey(iso) {
  const d = new Date(iso)
  return `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

const CHART_COLORS = ['#3b82f6','#22c55e','#f97316','#a855f7','#ec4899','#06b6d4','#eab308']

// ── KPI Card ─────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, bg }) {
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

// ── Vendor semaphore card ─────────────────────────────────────

function SellerCard({ seller, volume, count, target }) {
  const pct    = target > 0 ? Math.round((volume / target) * 100) : null
  const color  = pct === null ? 'bg-slate-600' : pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500'
  const label  = pct === null ? 'Sin meta' : pct >= 100 ? 'Meta superada' : pct >= 50 ? 'En progreso' : 'Por debajo'
  const textColor = pct === null ? 'text-slate-400' : pct >= 100 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 rounded-full shrink-0 ${color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{seller}</p>
          <p className={`text-xs ${textColor}`}>{label}{pct !== null ? ` · ${pct}%` : ''}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-slate-500">Volumen mes</p>
          <p className="font-semibold text-slate-300">{formatCurrency(volume)}</p>
        </div>
        <div>
          <p className="text-slate-500">Propuestas</p>
          <p className="font-semibold text-slate-300">{count}</p>
        </div>
      </div>
      {target > 0 && (
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-surface-700">
            <div
              className={`h-1.5 rounded-full transition-all ${color}`}
              style={{ width: `${Math.min(100, pct ?? 0)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-600">Meta: {formatCurrency(target)}</p>
        </div>
      )}
    </div>
  )
}

// ── Costs card ───────────────────────────────────────────────

function CostsCard({ items }) {
  const [open, setOpen] = useState(false)
  if (!items) return null

  const total = items.reduce((s, i) => s + i.value, 0)

  return (
    <div className="card p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-white">Costos operativos del mes</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-red-400">{formatCurrency(total)}</span>
          {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </div>
      </button>
      {open && (
        <div className="mt-4 space-y-2 border-t border-surface-700 pt-4">
          {items.map(i => (
            <div key={i.label} className="flex justify-between text-sm">
              <span className="text-slate-500">{i.label}</span>
              <span className="text-slate-300 font-medium">{formatCurrency(i.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 p-3 text-xs shadow-lg">
      <p className="mb-2 font-semibold text-white">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 10000
            ? formatCurrency(p.value)
            : p.value}
        </p>
      ))}
    </div>
  )
}

// ── Owner / Manager dashboard ─────────────────────────────────

function OwnerDashboard() {
  const { profile } = useAuth()
  const [loading, setLoading]     = useState(false)
  const [kpis, setKpis]           = useState({})
  const [monthly, setMonthly]     = useState([])
  const [formatMix, setFormatMix] = useState([])
  const [sellers, setSellers]     = useState([])
  const [costs, setCosts]         = useState(null)
  const [period, setPeriod]       = useState('current') // 'current' | 'previous'

  const load = useCallback(async () => {
    if (!profile?.org_id) return
    setLoading(true)

    const { start, end } = period === 'previous' ? monthRange(-1) : monthRange(0)

    const [invRes, propRes, teamRes, monthlyRes, itemsRes] = await Promise.all([
      supabase.from('inventory').select('id, is_available, cost_rent, cost_electricity, cost_taxes, cost_maintenance, cost_imponderables').eq('org_id', profile.org_id),
      supabase.from('proposals').select('id, status, total_value, created_by, created_at').eq('org_id', profile.org_id).gte('created_at', start).lte('created_at', end),
      supabase.from('profiles').select('id, full_name, role, monthly_target_ars').eq('org_id', profile.org_id),
      supabase.from('proposals').select('id, total_value, created_by, created_at, status').eq('org_id', profile.org_id).gte('created_at', sixMonthsAgo()),
      supabase.from('proposal_items').select('site_id, inventory(format)').eq('org_id', profile.org_id),
    ])

    // ── KPIs ──
    const inv     = invRes.data ?? []
    const props   = propRes.data ?? []
    const team    = teamRes.data ?? []
    const allProp = monthlyRes.data ?? []
    const items   = itemsRes.data ?? []

    const totalInv    = inv.length
    const occupiedInv = inv.filter(i => !i.is_available).length
    const accepted    = props.filter(p => p.status === 'accepted')
    const revenue     = accepted.reduce((s, p) => s + (p.total_value ?? 0), 0)

    // Costos totales del mes (suma de todos los carteles ocupados)
    const occupied = inv.filter(i => !i.is_available)
    const costItems = [
      { label: 'Alquiler / canon',  value: occupied.reduce((s,i) => s+(i.cost_rent||0), 0) },
      { label: 'Electricidad',      value: occupied.reduce((s,i) => s+(i.cost_electricity||0), 0) },
      { label: 'Impuestos',         value: occupied.reduce((s,i) => s+(i.cost_taxes||0), 0) },
      { label: 'Mantenimiento',     value: occupied.reduce((s,i) => s+(i.cost_maintenance||0), 0) },
      { label: 'Imponderables',     value: occupied.reduce((s,i) => s+(i.cost_imponderables||0), 0) },
    ].filter(c => c.value > 0)
    const totalCosts = costItems.reduce((s,c) => s+c.value, 0)
    const margin     = revenue > 0 ? Math.round(((revenue - totalCosts) / revenue) * 100) : null

    setKpis({
      occupied: occupiedInv,
      total: totalInv,
      acceptedCount: accepted.length,
      revenue,
      margin,
    })
    setCosts(costItems.length > 0 ? costItems : null)

    // ── Gráfico línea: ingresos por mes (últimos 6 meses) ──
    const monthMap = {}
    allProp.filter(p => p.status === 'accepted').forEach(p => {
      const key = getMonthKey(p.created_at)
      monthMap[key] = (monthMap[key] ?? 0) + (p.total_value ?? 0)
    })
    // Generar los 6 meses ordenados
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d   = new Date()
      d.setMonth(d.getMonth() - i)
      const key = getMonthKey(d.toISOString())
      months.push({ mes: MONTH_LABELS[d.getMonth()], ingresos: monthMap[key] ?? 0 })
    }
    setMonthly(months)

    // ── Gráfico dona: mix de formatos ──
    const fmtCount = {}
    items.forEach(item => {
      const fmt = item.inventory?.format ?? 'otros'
      fmtCount[fmt] = (fmtCount[fmt] ?? 0) + 1
    })
    setFormatMix(
      Object.entries(fmtCount).map(([id, value]) => ({
        name: FORMAT_MAP[id]?.label ?? id,
        value,
        color: FORMAT_MAP[id]?.color ?? '#64748b',
      }))
    )

    // ── Semáforo vendedores ──
    const salespersons = team.filter(t => t.role === 'salesperson')
    const sellerData = salespersons.map(s => {
      const myProps = props.filter(p => p.created_by === s.id && p.status === 'accepted')
      return {
        id: s.id,
        name: s.full_name ?? 'Sin nombre',
        volume: myProps.reduce((sum, p) => sum + (p.total_value ?? 0), 0),
        count: myProps.length,
        target: s.monthly_target_ars ?? 0,
      }
    })
    setSellers(sellerData)

    setLoading(false)
  }, [profile?.org_id, period])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Period filter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-slate-500">Resumen operativo de tu empresa OOH</p>
        </div>
        <div className="flex rounded-lg border border-surface-700 bg-surface-800 p-0.5 text-xs">
          {[
            { key: 'current',  label: 'Mes actual' },
            { key: 'previous', label: 'Mes anterior' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                period === opt.key ? 'bg-brand text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Carteles ocupados"
          value={`${kpis.occupied} / ${kpis.total}`}
          sub={kpis.total > 0 ? `${Math.round((kpis.occupied/kpis.total)*100)}% del inventario` : undefined}
          icon={MapPin} color="text-blue-400" bg="bg-blue-500/10"
        />
        <KpiCard
          label="Propuestas aprobadas"
          value={kpis.acceptedCount}
          sub="Este período"
          icon={FileText} color="text-purple-400" bg="bg-purple-500/10"
        />
        <KpiCard
          label="Volumen ventas"
          value={formatCurrency(kpis.revenue)}
          sub="Propuestas aceptadas"
          icon={TrendingUp} color="text-emerald-400" bg="bg-emerald-500/10"
        />
        <KpiCard
          label="Margen operativo"
          value={kpis.margin !== null ? `${kpis.margin}%` : '—'}
          sub={kpis.margin !== null ? 'Ingresos − costos fijos' : 'Cargá costos en inventario'}
          icon={Target} color="text-amber-400" bg="bg-amber-500/10"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Line: revenue trend */}
        <div className="card p-4 lg:col-span-2">
          <p className="mb-4 text-sm font-semibold text-white">Evolución de ingresos (6 meses)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthly}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut: format mix */}
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold text-white">Mix de formatos</p>
          {formatMix.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-xs text-slate-600">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={formatMix} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  dataKey="value" nameKey="name">
                  {formatMix.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Sellers semaphore */}
      {sellers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-white">Rendimiento del equipo</h3>
            <span className="text-xs text-slate-600">({sellers.length} vendedor{sellers.length !== 1 ? 'es' : ''})</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sellers.map(s => (
              <SellerCard key={s.id} seller={s.name} volume={s.volume} count={s.count} target={s.target} />
            ))}
          </div>
          {sellers.every(s => s.target === 0) && (
            <p className="mt-2 text-xs text-slate-600">
              Configurá metas mensuales en <Link to="/app/team" className="text-brand hover:underline">Equipo</Link> para activar el semáforo.
            </p>
          )}
        </div>
      )}

      {/* Costs */}
      {costs && <CostsCard items={costs} />}

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/app/campaigns" className="card p-4 group flex items-center justify-between hover:border-brand/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
              <Megaphone className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-white">Campañas</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-brand transition-colors" />
        </Link>
        <Link to="/app/proposals/new" className="card p-4 group flex items-center justify-between hover:border-brand/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10">
              <FileText className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-sm font-semibold text-white">Nueva propuesta</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-brand transition-colors" />
        </Link>
        <Link to="/app/inventory" className="card p-4 group flex items-center justify-between hover:border-brand/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
              <MapPin className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">Inventario</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-brand transition-colors" />
        </Link>
      </div>

      {/* Security badge */}
      <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-700">
        <Shield className="h-3.5 w-3.5" />
        <span>Tus datos están encriptados y aislados. Solo vos podés acceder a la información de tu empresa.</span>
      </div>
    </div>
  )
}

// ── Salesperson dashboard (simple) ────────────────────────────

function SalespersonDashboard() {
  const { profile } = useAuth()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!profile?.org_id) return
    const { start, end } = monthRange(0)
    Promise.all([
      supabase.from('proposals').select('id, status, total_value').eq('org_id', profile.org_id).eq('created_by', profile.id).gte('created_at', start).lte('created_at', end),
      supabase.from('proposals').select('id, status').eq('org_id', profile.org_id).eq('created_by', profile.id),
    ]).then(([monthly, all]) => {
      const monthProps = monthly.data ?? []
      const allProps   = all.data ?? []
      setData({
        monthVolume: monthProps.filter(p => p.status === 'accepted').reduce((s,p) => s+(p.total_value??0), 0),
        monthCount:  monthProps.filter(p => p.status === 'accepted').length,
        totalDraft:  allProps.filter(p => p.status === 'draft').length,
        totalSent:   allProps.filter(p => p.status === 'sent').length,
      })
    })
  }, [profile])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-white">
          Hola{profile?.full_name ? `, ${profile.full_name.trim().split(/\s+/)[0]}` : ''} 👋
        </h2>
        <p className="mt-1 text-sm text-slate-500">Tu actividad de este mes</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Volumen este mes" value={data ? formatCurrency(data.monthVolume) : '—'} icon={TrendingUp} color="text-emerald-400" bg="bg-emerald-500/10" />
        <KpiCard label="Aprobadas mes" value={data?.monthCount ?? '—'} icon={FileText} color="text-blue-400" bg="bg-blue-500/10" />
        <KpiCard label="Borradores" value={data?.totalDraft ?? '—'} icon={BarChart2} color="text-amber-400" bg="bg-amber-500/10" />
        <KpiCard label="Enviadas" value={data?.totalSent ?? '—'} icon={Megaphone} color="text-purple-400" bg="bg-purple-500/10" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/app/proposals/new" className="card p-5 group flex items-center justify-between hover:border-brand/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
              <FileText className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Nueva propuesta</p>
              <p className="text-xs text-slate-500">Planificar con IA</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-brand transition-colors" />
        </Link>
        <Link to="/app/proposals" className="card p-5 group flex items-center justify-between hover:border-brand/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Mis propuestas</p>
              <p className="text-xs text-slate-500">Ver historial</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-brand transition-colors" />
        </Link>
        <Link to="/app/campaigns" className="card p-5 group flex items-center justify-between hover:border-brand/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Megaphone className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Campañas</p>
              <p className="text-xs text-slate-500">Ver activas</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-brand transition-colors" />
        </Link>
      </div>

      <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-700">
        <Shield className="h-3.5 w-3.5" />
        <span>Tus datos están encriptados y aislados. Solo vos podés acceder a la información de tu empresa.</span>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────

export default function Dashboard() {
  const { isOwner, isManager } = useAuth()
  return isOwner || isManager ? <OwnerDashboard /> : <SalespersonDashboard />
}
