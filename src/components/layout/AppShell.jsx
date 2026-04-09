import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'
import { useAuth } from '../../context/AuthContext'

const PAGE_TITLES = {
  '/app':                  'Dashboard',
  '/app/campaigns':        'Campañas',
  '/app/inventory':        'Inventario',
  '/app/proposals':        'Propuestas',
  '/app/proposals/new':    'Planificador IA',
  '/app/reports':          'Reportes',
  '/app/team':             'Equipo',
  '/app/settings':         'Ajustes',
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { isExpired } = useAuth()

  const title = PAGE_TITLES[location.pathname] ?? 'OOH Planner'

  return (
    <div className="flex h-svh overflow-hidden bg-surface-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0 relative">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <Outlet />
          </div>
        </main>

        <MobileNav />

        {/* Trial expired overlay */}
        {isExpired && <TrialExpiredOverlay />}
      </div>
    </div>
  )
}

function TrialExpiredOverlay() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-surface-900/90 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700 bg-surface-800 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-2">
          Tu período de prueba gratuito ha vencido
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Para continuar usando OOH Planner y acceder a todas las funcionalidades,
          contactá a nuestro equipo.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="mailto:hola@oohplanner.net"
            className="btn-primary flex-1 text-center"
          >
            Contactar
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="btn-secondary flex-1"
          >
            Ver en modo lectura
          </button>
        </div>
      </div>
    </div>
  )
}
