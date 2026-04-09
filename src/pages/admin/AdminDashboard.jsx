import { useEffect, useState } from 'react'
import {
  Building2, Clock, CheckCircle, AlertCircle,
  PauseCircle, TrendingUp, UserPlus,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'

function MetricCard({ icon: Icon, label, value, color = 'brand' }) {
  const colors = {
    brand:  'bg-brand/10 text-brand',
    green:  'bg-emerald-500/10 text-emerald-400',
    amber:  'bg-amber-500/10 text-amber-400',
    red:    'bg-red-500/10 text-red-400',
    slate:  'bg-slate-500/10 text-slate-400',
  }
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value ?? '—'}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: orgs } = await supabase
        .from('organisations')
        .select('id, subscription_status, plan_price_usd, trial_ends_at, created_at')

      if (!orgs) { setLoading(false); return }

      const now = new Date()
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

      const total   = orgs.length
      const trials  = orgs.filter(o =>
        o.subscription_status === 'trial' && new Date(o.trial_ends_at) >= now
      ).length
      const active  = orgs.filter(o => o.subscription_status === 'active').length
      const expired = orgs.filter(o =>
        o.subscription_status === 'expired' ||
        (o.subscription_status === 'trial' && o.trial_ends_at && new Date(o.trial_ends_at) < now)
      ).length
      const suspended = orgs.filter(o => o.subscription_status === 'suspended').length
      const revenue = orgs
        .filter(o => o.subscription_status === 'active')
        .reduce((sum, o) => sum + (o.plan_price_usd ?? 0), 0)
      const recent = orgs.filter(o => new Date(o.created_at) >= sevenDaysAgo).length

      setStats({ total, trials, active, expired, suspended, revenue, recent })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-500">Resumen global de la plataforma</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={Building2}   label="Total empresas"       value={stats?.total}     color="brand" />
        <MetricCard icon={Clock}       label="En trial"             value={stats?.trials}    color="amber" />
        <MetricCard icon={CheckCircle} label="Activas"              value={stats?.active}    color="green" />
        <MetricCard icon={AlertCircle} label="Vencidas"             value={stats?.expired}   color="red"   />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard icon={PauseCircle} label="Suspendidas"          value={stats?.suspended} color="slate" />
        <MetricCard icon={TrendingUp}  label="Ingresos potenciales" value={`USD ${(stats?.revenue ?? 0).toLocaleString('es-AR')}`} color="green" />
        <MetricCard icon={UserPlus}    label="Nuevas (últimos 7d)"  value={stats?.recent}    color="brand" />
      </div>
    </div>
  )
}
