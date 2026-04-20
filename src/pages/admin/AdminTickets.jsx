import { useEffect, useState } from 'react'
import { X, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { sendEmail } from '../../lib/email'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import { cn } from '../../lib/utils'

const STATUS_CFG = {
  open:        { label: 'Abierto',    cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  in_progress: { label: 'En proceso', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  resolved:    { label: 'Resuelto',   cls: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  closed:      { label: 'Cerrado',    cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

const PRIORITY_CFG = {
  low:    { label: 'Baja',    cls: 'text-slate-500' },
  normal: { label: 'Normal',  cls: 'text-slate-400' },
  high:   { label: 'Alta',    cls: 'text-amber-400' },
  urgent: { label: 'Urgente', cls: 'text-red-400 font-semibold' },
}

const STATUS_OPTIONS = Object.entries(STATUS_CFG).map(([v, { label }]) => ({ value: v, label }))

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.open
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

export default function AdminTickets() {
  const [tickets, setTickets]   = useState([])
  const [orgs, setOrgs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [detail, setDetail]     = useState(null)
  const [saving, setSaving]     = useState(false)

  // Filters
  const [filterStatus, setFilterStatus]   = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterOrg, setFilterOrg]         = useState('')
  const [search, setSearch]               = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: ticketsData }, { data: orgsData }] = await Promise.all([
      supabase
        .from('support_tickets')
        .select('id, subject, message, status, priority, created_at, admin_notes, creator_email, creator_name, org_id, organisations(name)')
        .order('created_at', { ascending: false }),
      supabase.from('organisations').select('id, name').order('name'),
    ])
    setTickets(ticketsData ?? [])
    setOrgs(orgsData ?? [])
    setLoading(false)
  }

  async function handleSave() {
    if (!detail) return
    setSaving(true)

    const { error } = await supabase
      .from('support_tickets')
      .update({
        status: detail.status,
        admin_notes: detail.admin_notes,
        ...(detail.status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
      })
      .eq('id', detail.id)

    if (!error && detail.creator_email) {
      const statusLabel = STATUS_CFG[detail.status]?.label ?? detail.status
      await sendEmail({
        to: detail.creator_email,
        subject: `Tu ticket "${detail.subject}" fue actualizado`,
        html: `
          <div style="font-family:sans-serif;max-width:540px;margin:0 auto">
            <div style="background:#6366f1;padding:24px 32px;border-radius:12px 12px 0 0">
              <h1 style="color:#fff;font-size:18px;margin:0">⚡ OOH Planner — Soporte</h1>
            </div>
            <div style="background:#fff;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
              <p style="color:#1e293b;font-size:15px;font-weight:600">Hola${detail.creator_name ? ' ' + detail.creator_name : ''},</p>
              <p style="color:#64748b;font-size:14px;line-height:1.6;margin:12px 0">
                Tu ticket ha sido actualizado por nuestro equipo.
              </p>
              <table style="width:100%;border-collapse:collapse;font-size:13px;color:#475569;margin:16px 0">
                <tr><td style="padding:6px 0;font-weight:600;color:#1e293b;width:140px">Asunto:</td><td>${detail.subject}</td></tr>
                <tr><td style="padding:6px 0;font-weight:600;color:#1e293b">Nuevo estado:</td><td style="font-weight:600;color:#6366f1">${statusLabel}</td></tr>
              </table>
              ${detail.admin_notes ? `
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-top:8px">
                <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:8px">Nota del equipo</p>
                <p style="color:#475569;font-size:14px;line-height:1.6;margin:0">${detail.admin_notes.replace(/\n/g, '<br>')}</p>
              </div>` : ''}
              <p style="color:#64748b;font-size:13px;margin-top:24px">
                Cualquier consulta, respondé este mail o escribinos a <a href="mailto:hola@oohplanner.net" style="color:#6366f1">hola@oohplanner.net</a>
              </p>
            </div>
          </div>
        `,
      }).catch(() => {})
    }

    setSaving(false)
    setDetail(null)
    loadData()
  }

  const filtered = tickets.filter(t => {
    if (filterStatus   && t.status   !== filterStatus)   return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (filterOrg      && t.org_id   !== filterOrg)      return false
    if (search && !t.subject?.toLowerCase().includes(search.toLowerCase()) &&
        !t.creator_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white">Tickets de soporte</h1>
        <p className="text-sm text-slate-500">{tickets.length} tickets en total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Buscar…"
          className="input-field w-44 text-sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input-field text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="input-field text-sm" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">Todas las prioridades</option>
          <option value="low">Baja</option>
          <option value="normal">Normal</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
        <select className="input-field text-sm" value={filterOrg} onChange={e => setFilterOrg(e.target.value)}>
          <option value="">Todas las empresas</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {(filterStatus || filterPriority || filterOrg || search) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterOrg(''); setSearch('') }}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-surface-800 text-slate-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Empresa</th>
              <th className="px-4 py-3 text-left">Asunto</th>
              <th className="px-4 py-3 text-left">De</th>
              <th className="px-4 py-3 text-left">Prioridad</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map(t => (
              <tr
                key={t.id}
                onClick={() => setDetail({ ...t, admin_notes: t.admin_notes ?? '' })}
                className="hover:bg-slate-800/40 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-slate-300 text-xs">
                  {t.organisations?.name ?? '—'}
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <p className="font-medium text-white truncate">{t.subject}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  <p>{t.creator_name ?? '—'}</p>
                  <p className="text-slate-600">{t.creator_email ?? ''}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${PRIORITY_CFG[t.priority]?.cls ?? ''}`}>
                    {PRIORITY_CFG[t.priority]?.label ?? t.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(t.created_at).toLocaleDateString('es-AR')}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No hay tickets que coincidan con los filtros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-surface-800 shadow-2xl">
            <div className="flex items-start justify-between p-4 border-b border-slate-700 gap-3">
              <div>
                <h2 className="font-semibold text-white text-sm">{detail.subject}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {detail.organisations?.name ?? ''} · {detail.creator_name ?? ''} · {detail.creator_email ?? ''}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-white transition-colors shrink-0">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {detail.message && (
                <div className="rounded-lg bg-surface-700/60 p-3">
                  <p className="text-xs text-slate-400 mb-1 font-medium">Mensaje del usuario</p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{detail.message}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Estado</label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setDetail(p => ({ ...p, status: s.value }))}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                        detail.status === s.value
                          ? STATUS_CFG[s.value].cls
                          : 'border-slate-700 text-slate-400 hover:border-slate-500'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Notas internas / Respuesta al usuario
                </label>
                <textarea
                  className="input-field w-full min-h-[80px] resize-y"
                  placeholder="Esta nota se enviará al usuario por email al guardar…"
                  value={detail.admin_notes}
                  onChange={e => setDetail(p => ({ ...p, admin_notes: e.target.value }))}
                />
              </div>

              {detail.creator_email && (
                <p className="text-xs text-slate-600">
                  Al guardar se enviará una notificación a <strong className="text-slate-500">{detail.creator_email}</strong>
                </p>
              )}

              <Button onClick={handleSave} loading={saving} className="w-full">
                <Save className="h-4 w-4 mr-1.5" />
                Guardar y notificar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
