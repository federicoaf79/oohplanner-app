import { useState } from 'react'
import { Users, Target, BookUser, BarChart2, ChevronRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Card, { CardHeader } from '../../components/ui/Card'

// Placeholder page — 4 sections map to functionality that currently lives in
// Settings.jsx (as unreachable dead code) pending migration:
//   - Equipo y comisiones      → Settings.jsx activeTab === 'team'
//   - Reglas Comerciales       → Settings.jsx activeTab === 'commercial'
//   - Contactos Confidenciales → Settings.jsx activeTab === 'confidential_contacts'
//   - Reportes Confidenciales  → Settings.jsx activeTab === 'confidential_reports'
//
// The owner-only "Permitir acceso a Gerentes" toggle is currently local state
// only — no persistence. When the real access control is wired up, back it with
// a column on organisations (e.g. `inventory_settings_manager_access boolean`)
// and enforce at the RoleGuard + section-reveal level.

const SECTIONS = [
  {
    icon: Users,
    title: 'Equipo y comisiones',
    description: 'Gestión de vendedores y estructura de comisiones',
  },
  {
    icon: Target,
    title: 'Reglas Comerciales',
    description: 'Descuentos, márgenes y políticas de venta',
  },
  {
    icon: BookUser,
    title: 'Contactos Confidenciales',
    description: 'Contactos sensibles y facilitadores ocultos',
  },
  {
    icon: BarChart2,
    title: 'Reportes Confidenciales',
    description: 'Acceso a reportes de rentabilidad',
  },
]

export default function InventorySettings() {
  const { isOwner } = useAuth()

  // Local state only — see file-level comment. Default: false.
  const [allowManagerAccess, setAllowManagerAccess] = useState(false)

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-white">Ajustes de inventario</h2>
        <p className="text-sm text-slate-500">
          Configuración comercial y de equipo para tu operación de vía pública.
        </p>
      </div>

      {/* Owner-only access toggle */}
      {isOwner && (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="shrink-0 mt-0.5">
                <ShieldCheck className="h-5 w-5 text-brand" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Permitir acceso a Gerentes</p>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                  Cuando está activado, los usuarios con rol Manager pueden ver y editar estas secciones.
                  Por defecto está apagado — solo el Owner accede.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allowManagerAccess}
              onClick={() => setAllowManagerAccess(v => !v)}
              className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                allowManagerAccess ? 'bg-brand' : 'bg-surface-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  allowManagerAccess ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </Card>
      )}

      {/* Placeholder section cards */}
      <div className="space-y-3">
        {SECTIONS.map(({ icon: Icon, title, description }) => (
          <button
            key={title}
            type="button"
            className="w-full text-left card p-4 flex items-center gap-4 hover:border-brand/30 transition-colors cursor-default opacity-90"
            aria-disabled="true"
          >
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</p>
            </div>
            <span className="shrink-0 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Próximamente
            </span>
            <ChevronRight className="shrink-0 h-4 w-4 text-slate-600" />
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        Estas secciones están siendo migradas desde Configuración. La funcionalidad completa se
        habilitará en próximas versiones.
      </p>
    </div>
  )
}
