import { useAuth } from '../../context/AuthContext'
import { Megaphone, MapPin, FileText, TrendingUp, ArrowRight, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card, { CardHeader } from '../../components/ui/Card'
import { formatCurrency } from '../../lib/utils'

const STATS = [
  { label: 'Campañas activas', value: '—', icon: Megaphone, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { label: 'Espacios disponibles', value: '—', icon: MapPin, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { label: 'Propuestas enviadas', value: '—', icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { label: 'Revenue del mes', value: '—', icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
]

export default function Dashboard() {
  const { profile, role, isOwner, isManager } = useAuth()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold text-white">
          Hola, {profile?.full_name?.split(' ')[0]} 👋
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Aquí tienes un resumen de tu operación OOH
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <div className={`rounded-lg p-2 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/app/campaigns" className="card p-5 group flex items-center justify-between hover:border-brand/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Megaphone className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Campañas</p>
              <p className="text-xs text-slate-500">Gestiona tus campañas activas</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-brand transition-colors" />
        </Link>

        <Link to="/app/proposals" className="card p-5 group flex items-center justify-between hover:border-brand/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
              <FileText className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Nueva propuesta</p>
              <p className="text-xs text-slate-500">Crea y envía propuestas</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-brand transition-colors" />
        </Link>

        {(isOwner || isManager) && (
          <Link to="/app/inventory" className="card p-5 group flex items-center justify-between hover:border-brand/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <MapPin className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Inventario</p>
                <p className="text-xs text-slate-500">Administra tus espacios</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-brand transition-colors" />
          </Link>
        )}
      </div>

      {/* Recent activity placeholder */}
      <Card>
        <CardHeader title="Actividad reciente" subtitle="Últimas actualizaciones en tu organización" />
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-700 mb-3">
            <Clock className="h-6 w-6 text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-400">Sin actividad reciente</p>
          <p className="mt-1 text-xs text-slate-600">
            Las actualizaciones de tus campañas y propuestas aparecerán aquí
          </p>
        </div>
      </Card>
    </div>
  )
}
