import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, BookUser, MoreVertical, ChevronUp, ChevronDown, Mail, Phone, Lock, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABEL_MAP, ROLE_CATEGORY_MAP, CONTACT_ROLE_CATEGORIES } from '../../lib/contactRoles'
import ContactCard from '../../features/contacts/ContactCard'
import ContactFormModal from '../../features/contacts/ContactFormModal'
import ContactOnboardingWizard, { contactNeedsReview } from '../../features/contacts/ContactOnboardingWizard'

const ALL = '__all__'
const CAT_COLOR = Object.fromEntries(CONTACT_ROLE_CATEGORIES.map(c => [c.id, c.color]))

function RoleChips({ roles = [], incomplete = false }) {
  const first = roles[0]
  const color = first ? (CAT_COLOR[ROLE_CATEGORY_MAP[first]] ?? '#64748b') : null
  const overflow = roles.length - 1
  if (!first && !incomplete) return <span className="text-slate-500">—</span>
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {first && (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
          style={{ background: `${color}20`, color }}
        >
          {ROLE_LABEL_MAP[first] ?? first}
        </span>
      )}
      {overflow > 0 && <span className="text-xs text-slate-500">+{overflow}</span>}
      {incomplete && (
        <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs text-amber-400 whitespace-nowrap">
          Completar datos
        </span>
      )}
    </div>
  )
}

const TH = ({ children, className = '' }) => (
  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 ${className}`}>
    {children}
  </th>
)

export default function Contacts() {
  const { profile, isOwner, isManager, canSeeCommissions } = useAuth()
  const canEdit = isOwner || isManager

  const [contacts, setContacts]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterRole, setFilterRole]     = useState(ALL)
  const [filterStatus, setFilterStatus] = useState(ALL)
  const [filterIncomplete, setFilterIncomplete] = useState(false)
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const [sortDir, setSortDir]           = useState('asc')
  const [modal, setModal]               = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [openMenu, setOpenMenu]         = useState(null)
  const [showImport, setShowImport]     = useState(false)

  async function fetchContacts() {
    if (!profile?.org_id) return
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('name', { ascending: true })

    // Filtro de visibilidad para facilitadores con visibility='owner_only':
    //   - owner: ve todos
    //   - manager: solo si tiene see_sale_facilitators y confidentiality != 'strict'
    //   - salesperson: nunca
    // El resto de contactos pasa sin filtrar.
    const visible = (data ?? []).filter(c => {
      const isFacilitator = c.roles?.includes('facilitator')
      if (!isFacilitator) return true
      if (c.visibility !== 'owner_only') return true
      if (isOwner) return true
      if (isManager
          && canSeeCommissions('see_sale_facilitators')
          && c.confidentiality_level !== 'strict') return true
      return false
    })

    setContacts(visible)
    setLoading(false)
  }

  useEffect(() => { fetchContacts() }, [profile?.org_id])

  const usedRoles = useMemo(() => {
    const seen = new Set()
    contacts.forEach(c => c.roles?.forEach(r => seen.add(r)))
    return [...seen].sort()
  }, [contacts])

  const incompleteCount = useMemo(
    () => contacts.filter(c => c.is_active && contactNeedsReview(c)).length,
    [contacts]
  )

  const filtered = useMemo(() => contacts.filter(c => {
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
      if (filterStatus === 'active'   && !c.is_active) return false
      if (filterStatus === 'inactive' &&  c.is_active) return false
    }
    if (filterIncomplete && !contactNeedsReview(c)) return false
    if (visibilityFilter === 'org')        return c.visibility === 'org' || !c.visibility
    if (visibilityFilter === 'owner_only') return c.visibility === 'owner_only'
    return true
  }), [contacts, search, filterRole, filterStatus, filterIncomplete, visibilityFilter])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const cmp = (a.name ?? '').localeCompare(b.name ?? '', 'es')
    return sortDir === 'asc' ? cmp : -cmp
  }), [filtered, sortDir])

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

  async function toggleActive(contact) {
    const next = !contact.is_active
    await supabase.from('contacts').update({ is_active: next }).eq('id', contact.id)
    setContacts(cs => cs.map(c => c.id === contact.id ? { ...c, is_active: next } : c))
  }

  function handleImportDone(imported) {
    setContacts(cs => {
      const ids = new Set(imported.map(c => c.id))
      return [...cs.filter(c => !ids.has(c.id)), ...imported]
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    })
    setShowImport(false)
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
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2">
              <Upload className="h-4 w-4" /> Importar
            </button>
            <button onClick={() => setModal({ mode: 'create' })} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Nuevo contacto
            </button>
          </div>
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
            className="input-field pl-9"
          />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="input-field sm:w-48">
          <option value={ALL}>Todos los roles</option>
          {usedRoles.map(roleId => (
            <option key={roleId} value={roleId}>{ROLE_LABEL_MAP[roleId] ?? roleId}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field sm:w-36">
          <option value={ALL}>Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        {incompleteCount > 0 && (
          <button
            onClick={() => setFilterIncomplete(v => !v)}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              filterIncomplete
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                : 'border-surface-600 bg-surface-800 text-slate-400 hover:border-surface-500'
            }`}
          >
            Completar datos
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${
              filterIncomplete ? 'bg-amber-500/20 text-amber-400' : 'bg-surface-700 text-slate-500'
            }`}>
              {incompleteCount}
            </span>
          </button>
        )}
        {isOwner && (
          <select value={visibilityFilter} onChange={e => setVisibilityFilter(e.target.value)} className="input-field sm:w-44">
            <option value="all">Todos</option>
            <option value="org">Solo públicos</option>
            <option value="owner_only">Solo confidenciales</option>
          </select>
        )}
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
            <div className="flex gap-3 mt-2">
              <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2">
                <Upload className="h-4 w-4" /> Importar lista
              </button>
              <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
                Agregar primer contacto
              </button>
            </div>
          )}
        </div>

      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700 bg-surface-800/50">
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Nombre
                    {sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </th>
                <TH className="hidden md:table-cell">Razón social</TH>
                <TH>Roles</TH>
                <TH>Contacto</TH>
                <TH className="hidden md:table-cell">CUIT</TH>
                {canEdit && <th className="w-10 px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {sorted.map(contact => {
                const inactive   = !contact.is_active
                const incomplete = contactNeedsReview(contact) && contact.is_active
                const menuOpen   = openMenu === contact.id
                return (
                  <tr
                    key={contact.id}
                    className={`cursor-pointer hover:bg-surface-800/50 transition-colors ${inactive ? 'opacity-60' : ''}`}
                    onClick={() => setModal({ mode: 'edit', contact })}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {inactive && <span className="shrink-0 text-sm text-slate-500" title="Inactivo">⊘</span>}
                        {contact.visibility === 'owner_only' && (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        )}
                        <span className="font-medium text-white">{contact.name}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-slate-300">
                      {contact.legal_name || <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <RoleChips roles={contact.roles ?? []} incomplete={incomplete} />
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {contact.visibility === 'owner_only' ? (
                        <span className="text-xs text-slate-600 cursor-default" title="Datos confidenciales">•••</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`}
                              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                              <Mail className="h-3 w-3 shrink-0 text-slate-600" />
                              <span className="truncate max-w-[180px]">{contact.email}</span>
                            </a>
                          ) : <span className="text-xs text-slate-500">—</span>}
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`}
                              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                              <Phone className="h-3 w-3 shrink-0 text-slate-600" />
                              <span>{contact.phone}</span>
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 font-mono text-xs text-slate-400">
                      {contact.visibility === 'owner_only'
                        ? <span className="font-sans text-slate-600">•••</span>
                        : (contact.tax_id || <span className="font-sans text-slate-500">—</span>)
                      }
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="relative flex justify-end">
                          <button
                            onClick={() => setOpenMenu(v => v === contact.id ? null : contact.id)}
                            className="rounded-md p-1 text-slate-500 hover:bg-surface-700 hover:text-slate-300 transition-colors"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {menuOpen && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                              <div className="absolute right-0 top-7 z-20 w-44 rounded-lg border border-surface-700 bg-surface-800 py-1 shadow-xl">
                                <button
                                  onClick={() => { setOpenMenu(null); setModal({ mode: 'edit', contact }) }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-surface-700"
                                >
                                  {incomplete ? '✏ Completar datos' : 'Editar'}
                                </button>
                                <button
                                  onClick={() => { setOpenMenu(null); toggleActive(contact) }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-surface-700"
                                >
                                  {contact.is_active ? 'Desactivar' : 'Activar'}
                                </button>
                                <button
                                  onClick={() => { setOpenMenu(null); setDeleteConfirm(contact) }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-surface-700"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modales */}
      {modal && (
        <ContactFormModal
          contact={modal.contact ?? null}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {showImport && (
        <ContactOnboardingWizard
          existingContacts={contacts}
          onClose={() => setShowImport(false)}
          onDone={handleImportDone}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-surface-800 p-6 shadow-2xl">
            <h3 className="mb-2 font-semibold text-white">Eliminar contacto</h3>
            <p className="mb-6 text-sm text-slate-400">
              ¿Confirmás eliminar a <strong className="text-slate-200">{deleteConfirm.name}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancelar</button>
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
