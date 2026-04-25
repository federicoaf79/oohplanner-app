import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { UserPlus, Users, MoreVertical, Pencil, Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { getInitials } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'
import InviteMemberModal from '../../components/InviteMemberModal'

const ROLE_OPTIONS = [
  { value: 'owner',       label: 'Owner' },
  { value: 'manager',     label: 'Manager' },
  { value: 'salesperson', label: 'Vendedor' },
]

const ROLE_PILL_CLASS = {
  owner:       'bg-brand/15 text-brand border-brand/30',
  manager:     'bg-amber-500/15 text-amber-400 border-amber-500/30',
  salesperson: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

export default function Team() {
  const { profile, user } = useAuth()
  const [members, setMembers]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [savingRole, setSavingRole] = useState(null) // memberId in-flight
  const [toast, setToast]           = useState(null)
  const [openMenu, setOpenMenu]     = useState(null) // memberId whose ⋯ is open
  const [confirmDeactivate, setConfirmDeactivate] = useState(null)
  const [showEmailInfo, setShowEmailInfo]   = useState(false)

  const orgId   = profile?.org_id
  const isOwner = profile?.role === 'owner'
  const orgName = profile?.organisations?.name

  const loadTeam = useCallback(async () => {
    if (!orgId) return
    setLoading(true)

    // Preferred: RPC that joins auth.users.email. If it isn't installed yet,
    // fall back to basic profiles select (emails column is '—' for non-self).
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_team_members')

    if (!rpcErr && Array.isArray(rpcData)) {
      setMembers(rpcData)
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url, is_active, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
      setMembers((data ?? []).map(m => ({
        ...m,
        email: m.id === profile?.id ? user?.email ?? null : null,
      })))
    }
    setLoading(false)
  }, [orgId, profile?.id, user?.email])

  useEffect(() => { loadTeam() }, [loadTeam])

  const activeOwnerCount = useMemo(
    () => members.filter(m => m.role === 'owner' && m.is_active !== false).length,
    [members]
  )

  function flash(msg, kind = 'ok') {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 2500)
  }

  async function handleRoleChange(member, newRole) {
    if (newRole === member.role) return
    if (member.role === 'owner' && newRole !== 'owner' && activeOwnerCount <= 1) {
      flash('No podés cambiar el rol del único owner activo.', 'err')
      return
    }
    setSavingRole(member.id)
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', member.id)
    setSavingRole(null)
    if (error) {
      flash(`Error: ${error.message}`, 'err')
      return
    }
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m))
    flash('✓ Rol actualizado')
  }

  async function handleSaveName(memberId, newName) {
    const trimmed = (newName ?? '').trim()
    if (trimmed.length < 2) {
      flash('El nombre debe tener al menos 2 caracteres.', 'err')
      return false
    }
    if (trimmed.length > 100) {
      flash('Máximo 100 caracteres.', 'err')
      return false
    }
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: trimmed })
      .eq('id', memberId)
    if (error) {
      flash(`Error: ${error.message}`, 'err')
      return false
    }
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, full_name: trimmed } : m))
    flash('✓ Nombre actualizado')
    return true
  }

  async function handleDeactivate(member) {
    setConfirmDeactivate(null)
    if (member.role === 'owner' && activeOwnerCount <= 1) {
      flash('No podés desactivar al único owner activo.', 'err')
      return
    }
    const nextActive = !member.is_active
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: nextActive })
      .eq('id', member.id)
    if (error) {
      flash(`Error: ${error.message}`, 'err')
      return
    }
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_active: nextActive } : m))
    flash(nextActive ? '✓ Miembro activado' : '✓ Miembro desactivado')
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="mb-3 h-10 w-10 text-slate-600" />
        <p className="text-sm font-medium text-slate-400">Sin permisos</p>
        <p className="mt-1 text-xs text-slate-500">Esta página es solo para Owners.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">Equipo</h2>
          <p className="text-sm text-slate-500">
            {members.length} miembro{members.length !== 1 ? 's' : ''}
            {orgName ? <> · {orgName}</> : null}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowInvite(true)}>
          <UserPlus className="h-4 w-4" />
          Invitar miembro
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16">
          <Users className="mb-3 h-10 w-10 text-slate-600" />
          <p className="font-medium text-slate-400">Sin miembros</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-surface-700 text-left">
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rol</th>
                <th className="px-5 py-3.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {members.map(m => (
                <TeamRow
                  key={m.id}
                  member={m}
                  currentUserId={profile.id}
                  isOnlyOwner={m.role === 'owner' && activeOwnerCount <= 1}
                  saving={savingRole === m.id}
                  menuOpen={openMenu === m.id}
                  onOpenMenu={() => setOpenMenu(v => v === m.id ? null : m.id)}
                  onCloseMenu={() => setOpenMenu(null)}
                  onRoleChange={(r) => handleRoleChange(m, r)}
                  onDeactivate={() => { setOpenMenu(null); setConfirmDeactivate(m) }}
                  onSaveName={handleSaveName}
                  onEditEmail={() => setShowEmailInfo(true)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-2.5 text-sm shadow-lg border ${
          toast.kind === 'err'
            ? 'bg-red-500/15 border-red-500/30 text-red-300'
            : 'bg-teal-500/15 border-teal-500/30 text-teal-300'
        }`}>
          {toast.msg}
        </div>
      )}

      <InviteMemberModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onSuccess={loadTeam}
      />

      {showEmailInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowEmailInfo(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-surface-800 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-white mb-2">Cambio de email</h3>
            <p className="text-sm text-slate-400 mb-4">
              Por seguridad, el cambio de email requiere verificación del nuevo correo.
              Esta función estará disponible en la próxima versión.
            </p>
            <p className="text-xs text-slate-500 mb-5">
              Si necesitás cambiar un email urgentemente, contactá a soporte.
            </p>
            <Button className="w-full" onClick={() => setShowEmailInfo(false)}>
              Entendido
            </Button>
          </div>
        </div>
      )}

      {confirmDeactivate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmDeactivate(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-surface-800 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-white mb-2">
              {confirmDeactivate.is_active === false ? 'Activar miembro' : 'Desactivar miembro'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {confirmDeactivate.is_active === false ? (
                <>¿Reactivar a <strong className="text-slate-200">{confirmDeactivate.full_name ?? 'este miembro'}</strong>? Volverá a poder iniciar sesión.</>
              ) : (
                <>¿Desactivar a <strong className="text-slate-200">{confirmDeactivate.full_name ?? 'este miembro'}</strong>? No podrá iniciar sesión hasta que lo reactives.</>
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDeactivate(null)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={() => handleDeactivate(confirmDeactivate)}>
                {confirmDeactivate.is_active === false ? 'Activar' : 'Desactivar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TeamRow({ member, currentUserId, isOnlyOwner, saving, menuOpen, onOpenMenu, onCloseMenu, onRoleChange, onDeactivate, onSaveName, onEditEmail }) {
  const menuRef = useRef(null)
  const inputRef = useRef(null)
  const isSelf = member.id === currentUserId
  const inactive = member.is_active === false

  const [editingName, setEditingName] = useState(false)
  const [nameDraft,   setNameDraft]   = useState(member.full_name ?? '')
  const [savingName,  setSavingName]  = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onCloseMenu()
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen, onCloseMenu])

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingName])

  function startEditName() {
    setNameDraft(member.full_name ?? '')
    setEditingName(true)
  }

  function cancelEditName() {
    setNameDraft(member.full_name ?? '')
    setEditingName(false)
  }

  async function commitEditName() {
    const trimmed = nameDraft.trim()
    if (trimmed.length < 2 || trimmed.length > 100) return
    if (trimmed === (member.full_name ?? '')) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    const ok = await onSaveName(member.id, trimmed)
    setSavingName(false)
    if (ok) setEditingName(false)
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEditName()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditName()
    }
  }

  return (
    <tr className={`transition-colors ${inactive ? 'opacity-50' : 'hover:bg-surface-700/50'}`}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-brand">
            {getInitials(member.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  maxLength={100}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  disabled={savingName}
                  className="input-field text-sm py-1 px-2 w-full max-w-[260px]"
                />
                <button
                  type="button"
                  onClick={commitEditName}
                  disabled={savingName || nameDraft.trim().length < 2}
                  className="rounded-md p-1 text-teal-400 hover:bg-teal-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Guardar nombre"
                  title="Guardar (Enter)"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={cancelEditName}
                  disabled={savingName}
                  className="rounded-md p-1 text-rose-400 hover:bg-rose-500/15 disabled:opacity-50"
                  aria-label="Cancelar edición"
                  title="Cancelar (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-slate-100 truncate">{member.full_name ?? '—'}</p>
                <button
                  type="button"
                  onClick={startEditName}
                  className="rounded-md p-1 text-slate-500 hover:bg-surface-700 hover:text-slate-200 transition-colors"
                  aria-label="Editar nombre"
                  title="Editar nombre"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
            {!editingName && (
              <p className="text-xs text-slate-500">
                {isSelf ? 'Tú' : ''}
                {inactive ? <span className="ml-1.5 text-amber-400">· Inactivo</span> : null}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-5 py-3 hidden md:table-cell">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-xs break-all">{member.email ?? '—'}</span>
          {member.email && (
            <button
              type="button"
              onClick={onEditEmail}
              className="rounded-md p-1 text-slate-500 hover:bg-surface-700 hover:text-slate-200 transition-colors shrink-0"
              aria-label="Editar email"
              title="Editar email"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="relative inline-block">
          <select
            value={member.role}
            onChange={(e) => onRoleChange(e.target.value)}
            disabled={saving || isOnlyOwner}
            className={`appearance-none rounded-full border px-3 py-1 pr-7 text-xs font-semibold disabled:opacity-70 ${
              ROLE_PILL_CLASS[member.role] ?? ROLE_PILL_CLASS.salesperson
            }`}
            title={isOnlyOwner ? 'No podés cambiar el rol del único owner activo' : ''}
          >
            {ROLE_OPTIONS.map(o => (
              <option key={o.value} value={o.value} className="bg-surface-800 text-slate-100">
                {o.label}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-current opacity-70"
            viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </td>
      <td className="px-2 py-3 relative">
        <div ref={menuRef} className="relative flex justify-end">
          <button
            type="button"
            onClick={onOpenMenu}
            className="rounded-md p-1.5 text-slate-500 hover:bg-surface-700 hover:text-slate-200 transition-colors"
            aria-label="Opciones"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border border-surface-700 bg-surface-800 py-1 shadow-xl">
              <button
                type="button"
                onClick={() => { onCloseMenu(); startEditName() }}
                className="flex w-full items-center px-3 py-2 text-sm text-slate-300 hover:bg-surface-700"
              >
                Editar perfil
              </button>
              <button
                type="button"
                onClick={() => { onCloseMenu(); alert('Próxima versión') }}
                className="flex w-full items-center px-3 py-2 text-sm text-slate-300 hover:bg-surface-700"
              >
                Reenviar invitación
              </button>
              <button
                type="button"
                onClick={onDeactivate}
                disabled={isSelf}
                className="flex w-full items-center px-3 py-2 text-sm text-rose-400 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={isSelf ? 'No podés desactivarte a vos mismo' : ''}
              >
                {inactive ? 'Activar miembro' : 'Desactivar'}
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
