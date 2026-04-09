import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, Package, Shield, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'

export default function AdminLayout() {
  const { session, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [adminRole, setAdminRole] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!session?.user) {
      navigate('/app', { replace: true })
      return
    }
    async function checkAdmin() {
      const { data } = await supabase
        .from('admin_users')
        .select('admin_role')
        .eq('id', session.user.id)
        .single()
      if (!data) {
        navigate('/app', { replace: true })
        return
      }
      setAdminRole(data.admin_role)
      setChecking(false)
    }
    checkAdmin()
  }, [session, authLoading, navigate])

  if (authLoading || checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-900">
        <Spinner size="lg" />
      </div>
    )
  }

  const isSuperAdmin = adminRole === 'super_admin'

  const navItems = [
    { to: '/admin',          end: true,  label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/empresas',             label: 'Empresas',  icon: Building2 },
    { to: '/admin/planes',               label: 'Planes',    icon: Package },
    ...(isSuperAdmin ? [{ to: '/admin/admins', label: 'Admins', icon: Shield }] : []),
  ]

  return (
    <div className="flex h-svh overflow-hidden bg-surface-900">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-slate-800 flex flex-col bg-surface-900">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand" />
            <span className="font-bold text-white text-sm">Admin Panel</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 capitalize">
            {adminRole?.replace('_', ' ')}
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand/20 text-brand border border-brand/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <NavLink
            to="/app"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la app
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6">
          <Outlet context={{ adminRole }} />
        </div>
      </div>
    </div>
  )
}
