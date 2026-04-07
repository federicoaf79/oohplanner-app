import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'

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

  const title = PAGE_TITLES[location.pathname] ?? 'OOH Planner'

  return (
    <div className="flex h-svh overflow-hidden bg-surface-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <Outlet />
          </div>
        </main>

        <MobileNav />
      </div>
    </div>
  )
}
