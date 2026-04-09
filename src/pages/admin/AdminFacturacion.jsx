import { useEffect, useState } from 'react'
import { PlusCircle, Send, X, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { sendEmail } from '../../lib/email'
import { generateInvoiceHTML, invoiceStatusLabel, invoiceStatusClass } from '../../lib/invoiceTemplate'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const EMPTY_FORM = {
  orgId: '',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  planName: '',
  amountUsd: '',
  recipientEmail: '',
  invoiceNumber: '',
  notes: '',
}

async function generateInvoiceNumber() {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
  const num = String((count ?? 0) + 1).padStart(3, '0')
  return `OOH-${year}-${num}`
}

export default function AdminFacturacion() {
  const [invoices, setInvoices]   = useState([])
  const [orgs, setOrgs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [preview, setPreview]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [creating, setCreating]   = useState(false)
  const [sending, setSending]     = useState(null)
  const [error, setError]         = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: invData }, { data: orgsData }] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, organisations(name, billing_email, billing_cuit, billing_razon_social, billing_address, plan, plan_price_usd)')
        .order('created_at', { ascending: false }),
      supabase
        .from('organisations')
        .select('id, name, plan, plan_price_usd, billing_email, billing_cuit, billing_razon_social, billing_address')
        .order('name'),
    ])
    setInvoices(invData ?? [])
    setOrgs(orgsData ?? [])
    setLoading(false)
  }

  async function handleOrgChange(orgId) {
    const org = orgs.find(o => o.id === orgId)
    const invNum = await generateInvoiceNumber()
    setForm(p => ({
      ...p,
      orgId,
      planName: org?.plan ?? '',
      amountUsd: org?.plan_price_usd > 0 ? String(org.plan_price_usd) : '',
      recipientEmail: org?.billing_email ?? '',
      invoiceNumber: invNum,
    }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setCreating(true)

    const d = Number(form.month)
    const periodStart = `${form.year}-${String(d).padStart(2,'0')}-01`
    const periodEnd   = new Date(form.year, d, 0).toISOString().slice(0, 10)

    const { error: insErr } = await supabase
      .from('invoices')
      .insert({
        org_id: form.orgId,
        invoice_number: form.invoiceNumber,
        period_start: periodStart,
        period_end: periodEnd,
        plan_name: form.planName,
        amount_usd: Number(form.amountUsd),
        recipient_email: form.recipientEmail,
        notes: form.notes || null,
      })

    if (insErr) {
      setError(insErr.message)
      setCreating(false)
      return
    }

    setCreating(false)
    setShowModal(false)
    setForm(EMPTY_FORM)
    loadData()
  }

  async function handleSendEmail(inv) {
    if (!inv.recipient_email) {
      alert('Esta factura no tiene email de destinatario. Editá los datos fiscales de la empresa primero.')
      return
    }
    setSending(inv.id)

    const org = inv.organisations
    const html = generateInvoiceHTML({ invoice: inv, org })

    const { error: emailErr } = await sendEmail({
      to: inv.recipient_email,
      subject: `Factura ${inv.invoice_number} — OOH Planner`,
      html,
    })

    if (!emailErr) {
      await supabase
        .from('invoices')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', inv.id)
      loadData()
    } else {
      alert('Error al enviar: ' + (emailErr?.message ?? 'Error desconocido'))
    }

    setSending(null)
  }

  function set(field, value) {
    setForm(p => ({ ...p, [field]: value }))
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Facturación</h1>
          <p className="text-sm text-slate-500">{invoices.length} facturas emitidas</p>
        </div>
        <Button onClick={async () => {
          setError('')
          setForm({ ...EMPTY_FORM, invoiceNumber: await generateInvoiceNumber() })
          setShowModal(true)
        }} size="sm">
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Nueva factura
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-surface-800 text-slate-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Nº</th>
              <th className="px-4 py-3 text-left">Empresa</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Período</th>
              <th className="px-4 py-3 text-right">Importe</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 font-mono text-slate-300 text-xs">{inv.invoice_number}</td>
                <td className="px-4 py-3 text-slate-300">{inv.organisations?.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 capitalize">{inv.plan_name}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {inv.period_start
                    ? new Date(inv.period_start + 'T00:00:00').toLocaleDateString('es-AR', {
                        month: 'short', year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-white">
                  USD {Number(inv.amount_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${invoiceStatusClass(inv.status)}`}>
                    {invoiceStatusLabel(inv.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setPreview(inv)}
                      title="Ver factura"
                      className="rounded-lg p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleSendEmail(inv)}
                      disabled={sending === inv.id}
                      title={inv.recipient_email ? `Enviar a ${inv.recipient_email}` : 'Sin email de destinatario'}
                      className="rounded-lg p-1.5 text-slate-500 hover:text-brand hover:bg-brand/10 transition-colors disabled:opacity-40"
                    >
                      {sending === inv.id
                        ? <Spinner size="sm" />
                        : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No hay facturas generadas todavía
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New invoice modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-surface-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-surface-800">
              <h2 className="font-semibold text-white text-sm">Nueva factura</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Empresa</label>
                <select
                  className="input-field w-full"
                  value={form.orgId}
                  onChange={e => handleOrgChange(e.target.value)}
                  required
                >
                  <option value="">Seleccionar empresa…</option>
                  {orgs.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Mes</label>
                  <select className="input-field w-full" value={form.month} onChange={e => set('month', Number(e.target.value))}>
                    {MONTHS.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Año</label>
                  <input
                    type="number"
                    className="input-field w-full"
                    value={form.year}
                    onChange={e => set('year', Number(e.target.value))}
                    min="2024"
                    max="2099"
                  />
                </div>
              </div>

              <Input
                label="Número de factura"
                required
                value={form.invoiceNumber}
                onChange={e => set('invoiceNumber', e.target.value)}
                placeholder="OOH-2026-001"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Plan"
                  required
                  value={form.planName}
                  onChange={e => set('planName', e.target.value)}
                  placeholder="Pro"
                />
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Importe USD</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-field w-full"
                    value={form.amountUsd}
                    onChange={e => set('amountUsd', e.target.value)}
                    required
                    placeholder="450"
                  />
                </div>
              </div>

              <Input
                label="Email destinatario"
                type="email"
                value={form.recipientEmail}
                onChange={e => set('recipientEmail', e.target.value)}
                placeholder="facturacion@empresa.com"
              />

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Notas adicionales</label>
                <textarea
                  className="input-field w-full resize-none"
                  rows={2}
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Notas opcionales para la factura…"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" loading={creating} className="w-full">
                Crear factura
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Invoice preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-slate-700 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
              <span className="font-semibold text-slate-800 text-sm">
                {preview.invoice_number} — {preview.organisations?.name}
              </span>
              <button onClick={() => setPreview(null)} className="text-slate-500 hover:text-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <iframe
                srcDoc={generateInvoiceHTML({ invoice: preview, org: preview.organisations })}
                className="w-full min-h-[600px]"
                title={`Factura ${preview.invoice_number}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
