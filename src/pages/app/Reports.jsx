import { BarChart2 } from 'lucide-react'
import Card, { CardHeader } from '../../components/ui/Card'

export default function Reports() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-white">Reportes</h2>
        <p className="text-sm text-slate-500">Analytics y métricas de tu operación</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Revenue total', value: '—' },
          { label: 'Campañas completadas', value: '—' },
          { label: 'Tasa de cierre', value: '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card p-5">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader title="Revenue mensual" />
        <div className="flex h-48 items-center justify-center">
          <div className="text-center">
            <BarChart2 className="mx-auto mb-2 h-10 w-10 text-slate-600" />
            <p className="text-sm text-slate-500">Gráfica disponible con datos reales</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
