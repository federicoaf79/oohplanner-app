import { useEffect, useState } from 'react'
import { PlusCircle, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Card, { CardHeader } from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import Input from '../../components/ui/Input'

const STATUS_CFG = {
  open:        { label: 'Abierto',     cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  in_progress: { label: 'En proceso',  cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  resolved:    { label: 'Resuelto',    cls: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  closed:      { label: 'Cerrado',     cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

const PRIORITY_CFG = {
  low:    { label: 'Baja',    cls: 'text-slate-500' },
  normal: { label: 'Normal',  cls: 'text-slate-400' },
  high:   { label: 'Alta',    cls: 'text-amber-400' },
  urgent: { label: 'Urgente', cls: 'text-red-400 font-semibold' },
}

const EMPTY = { subject: '', message: '', priority: 'normal' }

export default function Support() {
  const { profile, org, user } = useAuth()
  const [tickets, setTickets]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')
  const [detail, setDetail]     = useState(null)

  useEffect(() => { loadTickets() }, [])

  async function loadTickets() {
    const { data } = await supabase
      .from('support_tickets')
      .select('id, subject, status, priority, created_at, admin_notes, message')
      .order('created_at', { ascending: false })
    setTickets(data ?? [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { data: ticket, error: insertErr } = await supabase
      .from('support_tickets')
      .insert({
        org_id: org?.id,
        created_by: profile?.id,
        creator_email: user?.email,
        creator_name: profile?.full_name,
        subject: form.subject,
        message: form.message,
        priority: form.priority,
      })
      .select()
      .single()

    if (insertErr) {
      setError(insertErr.message)
      setSubmitting(false)
      return
    }

    // Notify admin — recipient and "Support Ticket: " subject prefix are
    // hardcoded in the send-support-ticket edge function.
    await supabase.functions.invoke('send-support-ticket', {
      body: {
        subject: `${form.subject} — ${org?.name ?? 'sin empresa'}`,
        html: `
          <h2 style="font-family:sans-serif;color:#1e293b">Nuevo ticket de soporte</h2>
          <table style="font-family:sans-serif;font-size:14px;color:#475569;border-collapse:collapse">
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#1e293b">Empresa:</td><td>${org?.name ?? '—'}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#1e293b">De:</td><td>${profile?.full_name ?? '—'} &lt;${user?.email ?? '—'}&gt;</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#1e293b">Asunto:</td><td>${form.subject}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#1e293b">Prioridad:</td><td style="text-transform:capitalize">${form.priority}</td></tr>
          </table>
          <p style="font-family:sans-serif;font-size:14px;color:#475569;margin-top:16px"><strong>Mensaje:</strong><br>${form.message.replace(/\n/g, '<br>')}</p>
        `,
      },
    }).catch(() => { /* mail failure should not block the user */ })

    setForm(EMPTY)
    setShowModal(false)
    setSubmitting(false)
    loadTickets()
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Soporte</h2>
          <p className="text-sm text-slate-500">Envianos tus consultas y te respondemos a la brevedad</p>
        </div>
        <Button onClick={() => setShowModal(true)} size="sm">
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Nuevo ticket
        </Button>
      </div>

      {/* Link al Centro de ayuda */}
      <div className="rounded-xl border border-surface-700 bg-surface-800/40 px-4 py-3 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">¿Tenés dudas sobre cómo usar el sistema?</p>
        <a
          href="/app/faq"
          className="shrink-0 rounded-lg border border-surface-600 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-surface-700 transition-colors"
        >
          Ver Centro de ayuda →
        </a>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Mis tickets
        </h3>

      {tickets.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500 py-6 text-center">
            No tenés tickets abiertos. ¡Todo en orden! 🎉
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => (
            <button
              key={t.id}
              onClick={() => setDetail(t)}
              className="w-full text-left card p-4 hover:border-brand/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{t.subject}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(t.created_at).toLocaleDateString('es-AR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                    <span className={`ml-3 font-medium ${PRIORITY_CFG[t.priority]?.cls ?? ''}`}>
                      {PRIORITY_CFG[t.priority]?.label}
                    </span>
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </div>
            </button>
          ))}
        </div>
      )}
      </div>

      {/* Detail modal */}
      {detail && (
        <Modal title={detail.subject} onClose={() => setDetail(null)}>
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <StatusBadge status={detail.status} />
              <span className={`font-medium ${PRIORITY_CFG[detail.priority]?.cls}`}>
                {PRIORITY_CFG[detail.priority]?.label}
              </span>
              <span className="text-slate-500">
                {new Date(detail.created_at).toLocaleDateString('es-AR')}
              </span>
            </div>
            {detail.message && (
              <div className="rounded-lg bg-surface-700/50 p-3">
                <p className="text-xs text-slate-400 mb-1.5 font-medium">Tu mensaje</p>
                <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{detail.message}</p>
              </div>
            )}
            {detail.admin_notes && (
              <div className="rounded-lg bg-brand/10 border border-brand/30 p-3">
                <p className="text-xs text-brand mb-1.5 font-medium">Respuesta del equipo</p>
                <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{detail.admin_notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* New ticket modal */}
      {showModal && (
        <Modal title="Nuevo ticket de soporte" onClose={() => { setShowModal(false); setError('') }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Asunto"
              required
              value={form.subject}
              onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              placeholder="Descripción breve del problema"
            />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Descripción</label>
              <textarea
                required
                className="input-field w-full min-h-[100px] resize-y"
                placeholder="Detallá tu consulta o problema…"
                value={form.message}
                onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Prioridad</label>
              <select
                className="input-field w-full"
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
              >
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" loading={submitting} className="w-full">
              Enviar ticket
            </Button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.open
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-surface-800 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="font-semibold text-white text-sm">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
