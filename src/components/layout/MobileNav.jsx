import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Megaphone, FileText, Settings, BarChart2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'

const NAV = [
  { label: 'Inicio',     path: '/app',           icon: LayoutDashboard, end: true,  roles: ['owner','manager','salesperson'] },
  { label: 'Campañas',   path: '/app/campaigns', icon: Megaphone,                   roles: ['owner','manager','salesperson'] },
  { label: 'Propuestas', path: '/app/proposals', icon: FileText,                    roles: ['owner','manager','salesperson'] },
  { label: 'Reportes',   path: '/app/reports',   icon: BarChart2,                   roles: ['owner','manager'] },
  { label: 'Ajustes',    path: '/app/settings',  icon: Settings,                    roles: ['owner','manager','salesperson'] },
]

export default function MobileNav() {
  const { role } = useAuth()
  const items = NAV.filter(n => n.roles.includes(role))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-surface-700 bg-surface-900 lg:hidden">
      {items.map(({ label, path, icon: Icon, end }) => (
        <NavLink
          key={path}
          to={path}
          end={end}
          className={({ isActive }) => cn(
            'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
            isActive ? 'text-brand' : 'text-slate-500'
          )}
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
