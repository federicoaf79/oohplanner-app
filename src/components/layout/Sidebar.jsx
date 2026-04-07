import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Megaphone, MapPin, FileText,
  BarChart2, Users, Settings, X, Zap
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'

const NAV = [
  { label: 'Dashboard',   path: '/app',             icon: LayoutDashboard, end: true,  roles: ['owner','manager','salesperson'] },
  { label: 'Campañas',    path: '/app/campaigns',   icon: Megaphone,                   roles: ['owner','manager','salesperson'] },
  { label: 'Inventario',  path: '/app/inventory',   icon: MapPin,                      roles: ['owner','manager'] },
  { label: 'Propuestas',  path: '/app/proposals',   icon: FileText,                    roles: ['owner','manager','salesperson'] },
  { label: 'Reportes',    path: '/app/reports',     icon: BarChart2,                   roles: ['owner','manager'] },
  { label: 'Equipo',      path: '/app/team',        icon: Users,                       roles: ['owner'] },
  { label: 'Ajustes',     path: '/app/settings',    icon: Settings,                    roles: ['owner','manager','salesperson'] },
]

export default function Sidebar({ open, onClose }) {
  const { role, org, profile } = useAuth()
  const items = NAV.filter(n => n.roles.includes(role))

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-surface-700 bg-surface-900 transition-transform duration-200 lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-surface-700">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">OOH Planner</p>
              <p className="text-xs text-slate-500 truncate max-w-[120px]">{org?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-surface-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {items.map(({ label, path, icon: Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              onClick={() => onClose?.()}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand/10 text-brand'
                  : 'text-slate-400 hover:bg-surface-800 hover:text-slate-200'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="border-t border-surface-700 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-brand">
              {profile?.full_name?.split(' ').map(w => w[0]).slice(0,2).join('') ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200">{profile?.full_name}</p>
              <p className="truncate text-xs text-slate-500 capitalize">{role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
