import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { UserPlus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

const ROLE_OPTIONS = ['super_admin', 'admin', 'support']
const ROLE_LABELS  = { super_admin: 'Super Admin', admin: 'Admin', support: 'Support' }

export default function AdminAdmins() {
  const { adminRole } = useOutletContext()
  const isSuperAdmin  = adminRole === 'super_admin'

  const [admins, setAdmins]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState('')
  const [role, setRole]         = useState('admin')
  const [adding, setAdding]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { loadAdmins() }, [])

  async function loadAdmins() {
    const { data } = await supabase
      .from('admin_users')
      .select('id, admin_role, created_at, profiles(full_name)')
      .order('created_at')
    setAdmins(data ?? [])
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setAdding(true)

    const { error: insertErr } = await supabase
      .from('admin_users')
      .insert({ id: userId.trim(), admin_role: role })

    if (insertErr) {
      setError(insertErr.message)
    } else {
      setUserId('')
      loadAdmins()
    }
    setAdding(false)
  }

  async function handleChangeRole(id, newRole) {
    await supabase.from('admin_users').update({ admin_role: newRole }).eq('id', id)
    setAdmins(prev => prev.map(a => a.id === id ? { ...a, admin_role: newRole } : a))
  }

  async function handleRevoke(id) {
    if (!confirm('¿Revocar acceso de administrador a este usuario?')) return
    await supabase.from('admin_users').delete().eq('id', id)
    setAdmins(prev => prev.filter(a => a.id !== id))
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-slate-400 font-medium">Acceso restringido</p>
        <p className="text-sm text-slate-600">Solo los super_admin pueden gestionar el acceso de administradores.</p>
      </div>
    )
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white">Admins</h1>
        <p className="text-sm text-slate-500">Gestión de acceso al panel de administración</p>
      </div>

      <Card>
        <CardHeader
          title="Agregar administrador"
          subtitle="El usuario debe tener cuenta activa en la plataforma"
        />
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                User ID (UUID)
              </label>
              <input
                className="input-field w-full text-xs font-mono"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-slate-600">
                Encontralo en Supabase → Authentication → Users
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Rol</label>
              <select
                className="input-field w-full"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                {ROLE_OPTIONS.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" loading={adding} size="sm">
            <UserPlus className="h-4 w-4 mr-1.5" />
            Agregar admin
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title={`Administradores actuales (${admins.length})`} />
        <div className="space-y-2">
          {admins.map(admin => (
            <div
              key={admin.id}
              className="flex items-center justify-between rounded-lg border border-slate-700 px-4 py-3 gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {admin.profiles?.full_name ?? 'Sin nombre'}
                </p>
                <p className="text-xs text-slate-500 font-mono truncate">{admin.id}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  className="input-field text-xs py-1"
                  value={admin.admin_role}
                  onChange={e => handleChangeRole(admin.id, e.target.value)}
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleRevoke(admin.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  title="Revocar acceso"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {admins.length === 0 && (
            <p className="text-sm text-slate-500 py-6 text-center">
              No hay administradores configurados.
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
