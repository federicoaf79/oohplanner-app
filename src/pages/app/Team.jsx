import { useState, useEffect } from 'react'
import { UserPlus, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { RoleBadge } from '../../components/ui/Badge'
import { getInitials } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'

export default function Team() {
  const { profile } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.org_id) return
    supabase
      .from('profiles')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setMembers(data ?? []); setLoading(false) })
  }, [profile?.org_id])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Equipo</h2>
          <p className="text-sm text-slate-500">{members.length} miembros</p>
        </div>
        <Button size="sm">
          <UserPlus className="h-4 w-4" />
          Invitar miembro
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16">
          <Users className="mb-3 h-10 w-10 text-slate-600" />
          <p className="font-medium text-slate-400">Sin miembros</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700 text-left">
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Rol</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-surface-700/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-brand">
                        {getInitials(m.full_name)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-100">{m.full_name ?? '—'}</p>
                        <p className="text-xs text-slate-500">{m.id === profile.id ? 'Tú' : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <RoleBadge role={m.role} />
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      m.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {m.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
