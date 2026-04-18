import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, BookUser } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABEL_MAP } from '../../lib/contactRoles'
import ContactCard from '../../features/contacts/ContactCard'
import ContactFormModal from '../../features/contacts/ContactFormModal'

const ALL = '__all__'

export default function Contacts() {
  const { profile, isOwner, isManager } = useAuth()
  const canEdit = isOwner || isManager

  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState(ALL)
  const [filterStatus, setFilterStatus] = useState(ALL)
  const [modal, setModal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  async function fetchContacts() {
    if (!profile?.org_id) return
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('name', { ascending: true })
    setContacts(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchContacts() }, [profile?.org_id])

  const usedRoles = useMemo(() => {
    const seen = new Set()
    contacts.forEach(c => c.roles?.forEach(r => seen.add(r)))
    return [...seen].sort()
  }, [contacts])

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      if (search) {
        const q = search.toLowerCase()
        if (
          !c.name?.toLowerCase().includes(q) &&
          !c.legal_name?.toLowerCase().includes(q) &&
          !c.email?.toLowerCase().includes(q)
        ) return false
      }
      if (filterRole !== ALL && !c.roles?.includes(filterRole)) return false
      if (filterStatus !== ALL) {
        if (filterStatus === 'active' && !c.is_active) return false
        if (filterStatus === 'inactive' && c.is_active) return false
      }
      return true
    })
  }, [contacts, search, filterRole, filterStatus])

  function handleSaved(saved) {
    if (modal?.mode === 'edit') {
      setContacts(cs => cs.map(c => c.id === saved.id ? saved : c))
    } else {
      setContacts(cs => [...cs, saved].sort((a, b) => a.name.localeCompare(b.name)))
    }
    setModal(null)
  }

  async function confirmDelete(contact) {
    await supabase.from('contacts').delete().eq('id', contact.id)
    setContacts(cs => cs.filter(c => c.id !== contact.id))
    setDeleteConfirm(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-white">
          Contactos
          <span className="ml-2 text-sm font-normal text-slate-500">({contacts.length})</span>
        </h1>
        {canEdit && (
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="btn-primary flex shrink-0 items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Nuevo contacto
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, empresa o email…"
            className="input w-full pl-9"
          />
        </div>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="input sm:w-52"
        >
          <option value={ALL}>Todos los roles</option>
          {usedRoles.map(roleId => (
            <option key={roleId} value={roleId}>{ROLE_LABEL_MAP[roleId] ?? roleId}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="input sm:w-40"
        >
          <option value={ALL}>Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <BookUser className="h-10 w-10 text-slate-700" />
          <p className="font-medium text-slate-400">
            {contacts.length === 0 ? 'Todavía no hay contactos' : 'Sin resultados para esa búsqueda'}
          </p>
          {contacts.length === 0 && canEdit && (
            <button
              onClick={() => setModal({ mode: 'create' })}
              className="btn-primary mt-2"
            >
              Agregar primer contacto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(contact => (
            <ContactCard
              key={contact.id}
              contact={contact}
              canEdit={canEdit}
              onEdit={c => setModal({ mode: 'edit', contact: c })}
              onDelete={c => setDeleteConfirm(c)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (
        <ContactFormModal
          contact={modal.contact ?? null}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-surface-800 p-6 shadow-2xl">
            <h3 className="mb-2 font-semibold text-white">Eliminar contacto</h3>
            <p className="mb-6 text-sm text-slate-400">
              ¿Confirmás eliminar a{' '}
              <strong className="text-slate-200">{deleteConfirm.name}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={() => confirmDelete(deleteConfirm)}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
