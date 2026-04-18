import { useState } from 'react'
import { MoreVertical, Mail, Phone, Edit2, Trash2 } from 'lucide-react'
import { ROLE_LABEL_MAP, ROLE_CATEGORY_MAP, CONTACT_ROLE_CATEGORIES } from '../../lib/contactRoles'

const CAT_COLOR = Object.fromEntries(CONTACT_ROLE_CATEGORIES.map(c => [c.id, c.color]))

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
}

function avatarColor(roles = []) {
  const cat = ROLE_CATEGORY_MAP[roles[0]]
  return CAT_COLOR[cat] ?? '#64748b'
}

export default function ContactCard({ contact, onEdit, onDelete, canEdit }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const roles = contact.roles ?? []
  const visible = roles.slice(0, 3)
  const overflow = roles.length - 3

  return (
    <div className="card relative flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: avatarColor(roles) }}
        >
          {initials(contact.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-slate-100">{contact.name}</p>
            {!contact.is_active && (
              <span className="shrink-0 rounded-full bg-surface-700 px-2 py-0.5 text-xs text-slate-400">
                Inactivo
              </span>
            )}
          </div>
          {contact.legal_name && (
            <p className="truncate text-xs text-slate-500">{contact.legal_name}</p>
          )}
        </div>
        {canEdit && (
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="rounded-md p-1 text-slate-500 hover:bg-surface-700 hover:text-slate-300"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-7 z-20 w-40 rounded-lg border border-surface-700 bg-surface-800 py-1 shadow-xl">
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(contact) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-surface-700"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(contact) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-surface-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Role chips */}
      {roles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visible.map(roleId => {
            const cat = ROLE_CATEGORY_MAP[roleId]
            const color = CAT_COLOR[cat] ?? '#64748b'
            return (
              <span
                key={roleId}
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: `${color}20`, color }}
              >
                {ROLE_LABEL_MAP[roleId] ?? roleId}
              </span>
            )
          })}
          {overflow > 0 && (
            <span className="rounded-full bg-surface-700 px-2 py-0.5 text-xs text-slate-400">
              +{overflow}
            </span>
          )}
        </div>
      )}

      {/* Contact info */}
      <div className="flex flex-col gap-1">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-2 truncate text-xs text-slate-400 hover:text-slate-200"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-slate-600" />
            <span className="truncate">{contact.email}</span>
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200"
          >
            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-600" />
            <span>{contact.phone}</span>
          </a>
        )}
      </div>
    </div>
  )
}
