import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, LogOut, User, ChevronDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { RoleBadge } from '../ui/Badge'

export default function Topbar({ onMenuClick, title }) {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    await signOut()
    // No llamar navigate('/login') aquí: Login.jsx redirige a /app si session
    // todavía está seteada (stale state) creando un loop. AuthGuard redirige
    // automáticamente en cuanto session se limpia por el evento SIGNED_OUT.
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-surface-700 bg-surface-900 px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-md text-slate-400 hover:text-slate-200 hover:bg-surface-800 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-slate-100 lg:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 rounded-md text-slate-400 hover:text-slate-200 hover:bg-surface-800 relative">
          <Bell className="h-5 w-5" />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-surface-800 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-brand">
              {profile?.full_name?.split(' ').map(w => w[0]).slice(0,2).join('') ?? '?'}
            </div>
            <span className="hidden sm:block font-medium">{profile?.full_name?.split(' ')[0]}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-surface-700 bg-surface-800 shadow-xl animate-fade-in z-50">
              <div className="p-3 border-b border-surface-700">
                <p className="text-sm font-semibold text-slate-100">{profile?.full_name}</p>
                <div className="mt-1">
                  <RoleBadge role={role} />
                </div>
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => { navigate('/app/settings'); setMenuOpen(false) }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-surface-700 hover:text-white transition-colors"
                >
                  <User className="h-4 w-4" />
                  Mi perfil
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
