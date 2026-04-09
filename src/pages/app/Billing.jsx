import { useEffect, useState } from 'react'
import { FileText, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Card, { CardHeader } from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../context/AuthContext'
import { generateInvoiceHTML, invoiceStatusLabel, invoiceStatusClass } from '../../lib/invoiceTemplate'

export default function Billing() {
  const { org } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)
  const [preview, setPreview]   = useState(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
      setInvoices(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-white">Facturación</h2>
        <p className="text-sm text-slate-500">Historial de facturas de tu organización</p>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500 py-6 text-center">
            Todavía no hay facturas emitidas para tu organización.
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-surface-800 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Nº Factura</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-right">Importe</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Ver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-300 text-xs">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{inv.plan_name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {inv.period_start
                      ? new Date(inv.period_start + 'T00:00:00').toLocaleDateString('es-AR', {
                          month: 'long', year: 'numeric',
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
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setPreview(inv)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                      title="Ver factura"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-slate-700 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
              <span className="font-semibold text-slate-800 text-sm">
                Factura {preview.invoice_number}
              </span>
              <button onClick={() => setPreview(null)} className="text-slate-500 hover:text-slate-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <iframe
                srcDoc={generateInvoiceHTML({ invoice: preview, org })}
                className="w-full h-full min-h-[600px]"
                title={`Factura ${preview.invoice_number}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
