import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Megaphone, MapPin, FileText,
  BarChart2, Users, Settings, X, Receipt, Crosshair,
  BookUser, HelpCircle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'

// Sidebar navigation organised by functional sections.
// Sections with no visible items (after role filtering) are hidden entirely —
// no orphan headers.
const NAV_SECTIONS = [
  // Section 1: Dashboard — no header, no top border.
  {
    items: [
      { label: 'Dashboard', path: '/app', icon: LayoutDashboard, end: true,
        roles: ['owner', 'manager', 'salesperson'] },
    ],
  },

  // Section 2: Gestión de Inventario
  {
    header: 'GESTIÓN DE INVENTARIO',
    items: [
      { label: 'Inventario',         path: '/app/inventory',   icon: MapPin,
        roles: ['owner', 'manager'] },
      { label: 'Reportes',           path: '/app/reports',     icon: BarChart2,
        roles: ['owner', 'manager'] },
      { label: 'Editor de Zonas',    path: '/app/zone-editor', icon: Crosshair,
        roles: ['owner', 'manager'] },
      { label: 'Facturación',        path: '/app/billing',     icon: Receipt,
        roles: ['owner'] },
      { label: 'Ajustes Inventario', path: '/app/inventory-settings', icon: Settings,
        roles: ['owner', 'manager'] },
    ],
  },

  // Section 3: Gestión Comercial
  {
    header: 'GESTIÓN COMERCIAL',
    items: [
      { label: 'Propuestas', path: '/app/proposals', icon: FileText,
        roles: ['owner', 'manager', 'salesperson'] },
      { label: 'Campañas',   path: '/app/campaigns', icon: Megaphone,
        roles: ['owner', 'manager', 'salesperson'] },
      { label: 'Contactos',  path: '/app/contacts',  icon: BookUser,
        roles: ['owner', 'manager', 'salesperson'] },
      { label: 'Equipo',     path: '/app/team',      icon: Users,
        roles: ['owner'] },
      { label: 'Soporte',    path: '/app/support',   icon: HelpCircle,
        roles: ['owner', 'manager', 'salesperson'] },
    ],
  },

  // Section 4: Global settings — separator line, no header.
  {
    items: [
      { label: 'Configuración', path: '/app/settings', icon: Settings,
        roles: ['owner', 'manager', 'salesperson'] },
    ],
  },
]

export default function Sidebar({ open, onClose }) {
  const { role, org, profile } = useAuth()

  // Pre-compute visible sections so empty ones (and their headers) are skipped.
  const visibleSections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0)

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
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo.png"
              alt="OOH Planner"
              className="h-10 w-auto flex-shrink-0"
            />
            {org?.name && (
              <p className="text-xs text-slate-500 truncate">{org.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-surface-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {visibleSections.map((section, idx) => {
            const isFirst = idx === 0
            return (
              <div
                key={section.header ?? `section-${idx}`}
                className={!isFirst ? 'border-t border-slate-700/50' : ''}
              >
                {section.header ? (
                  <p className="pt-6 pb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {section.header}
                  </p>
                ) : !isFirst ? (
                  // No-header section after a separator: add breathing room above the items.
                  <div className="pt-3" aria-hidden="true" />
                ) : null}
                <div className="space-y-0.5">
                  {section.items.map(({ label, path, icon: Icon, end }) => (
                    <NavLink
                      key={label}
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
                </div>
              </div>
            )
          })}
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
