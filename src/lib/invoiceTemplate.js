/**
 * Generates the HTML template for an OOH Planner invoice.
 */
export function generateInvoiceHTML({ invoice, org }) {
  const periodStart = invoice.period_start
    ? new Date(invoice.period_start + 'T00:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    : '—'
  const createdAt = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Factura ${invoice.invoice_number}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; color: #1e293b; }
  .wrapper { max-width: 680px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
  .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px 40px; }
  .header-logo { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
  .header-sub { font-size: 13px; color: rgba(255,255,255,.75); margin-top: 4px; }
  .invoice-band { background: #f1f5f9; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; }
  .invoice-number { font-size: 18px; font-weight: 700; color: #1e293b; }
  .invoice-date { font-size: 13px; color: #64748b; }
  .body { padding: 36px 40px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 12px; }
  .client-name { font-size: 20px; font-weight: 700; color: #1e293b; }
  .client-detail { font-size: 13px; color: #64748b; margin-top: 4px; line-height: 1.6; }
  .divider { height: 1px; background: #e2e8f0; margin: 28px 0; }
  .item-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .item-desc { font-size: 15px; font-weight: 600; color: #1e293b; }
  .item-period { font-size: 13px; color: #64748b; margin-top: 3px; }
  .item-amount { font-size: 22px; font-weight: 800; color: #6366f1; white-space: nowrap; }
  .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-top: 24px; }
  .notes-text { font-size: 13px; color: #64748b; line-height: 1.6; }
  .payment-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-top: 28px; }
  .payment-title { font-size: 14px; font-weight: 700; color: #1d4ed8; margin-bottom: 6px; }
  .payment-text { font-size: 13px; color: #1e40af; line-height: 1.6; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 40px; text-align: center; }
  .footer-text { font-size: 12px; color: #94a3b8; line-height: 1.6; }
  .badge { display: inline-block; background: #ccfbf1; color: #0d9488; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: .5px; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="header-logo">⚡ OOH Planner</div>
    <div class="header-sub">Plataforma de planificación publicitaria OOH</div>
  </div>

  <div class="invoice-band">
    <div>
      <div class="invoice-number">Factura ${invoice.invoice_number}</div>
      <div class="invoice-date">Emitida el ${createdAt}</div>
    </div>
    <span class="badge">Período: ${periodStart}</span>
  </div>

  <div class="body">
    <div class="section-title">Facturado a</div>
    <div class="client-name">${org?.name ?? invoice.org_id}</div>
    <div class="client-detail">
      ${org?.billing_razon_social ? `Razón social: ${org.billing_razon_social}<br>` : ''}
      ${org?.billing_cuit ? `CUIT: ${org.billing_cuit}<br>` : ''}
      ${org?.billing_address ? `Dirección: ${org.billing_address}<br>` : ''}
      ${invoice.recipient_email ? `Email: ${invoice.recipient_email}` : ''}
    </div>

    <div class="divider"></div>

    <div class="section-title">Detalle del servicio</div>
    <div class="item-row">
      <div>
        <div class="item-desc">Plan ${invoice.plan_name} — OOH Planner</div>
        <div class="item-period">Período: ${periodStart}</div>
      </div>
      <div class="item-amount">USD ${Number(invoice.amount_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
    </div>

    ${invoice.notes ? `
    <div class="notes-box">
      <div class="notes-text"><strong>Notas:</strong> ${invoice.notes}</div>
    </div>` : ''}

    <div class="payment-box">
      <div class="payment-title">Instrucciones de pago</div>
      <div class="payment-text">
        Para coordinar el método de pago y confirmar la factura, contactar a:<br>
        <strong>hola@oohplanner.net</strong><br><br>
        Indicar el número de factura <strong>${invoice.invoice_number}</strong> en el asunto del correo.
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-text">
      OOH Planner — Plataforma de planificación publicitaria out-of-home<br>
      <a href="mailto:hola@oohplanner.net" style="color:#6366f1;">hola@oohplanner.net</a><br><br>
      Este documento es una factura simulada generada automáticamente por OOH Planner.
    </div>
  </div>
</div>
</body>
</html>`
}

export function invoiceStatusLabel(status) {
  return {
    pending: 'Pendiente',
    sent:    'Enviada',
    paid:    'Pagada',
    overdue: 'Vencida',
  }[status] ?? status
}

export function invoiceStatusClass(status) {
  return {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    sent:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
    paid:    'bg-teal-500/20 text-teal-400 border-teal-500/30',
    overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
  }[status] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}
