/**
 * generateProposalPDF
 * Genera y descarga un PDF de propuesta OOH usando jsPDF (texto nativo, sin html2canvas).
 * No dependemos de html2canvas para evitar problemas de CORS con tiles de mapas.
 */

import { formatCurrency } from '../../lib/utils'
import { FORMAT_MAP } from '../../lib/constants'

const BRAND  = [99, 102, 241]   // #6366f1 indigo
const DARK   = [15,  23,  42]   // slate-900
const MID    = [51,  65,  85]   // slate-700
const LIGHT  = [148, 163, 184]  // slate-400
const WHITE  = [248, 250, 252]  // slate-50
const GREEN  = [34, 197, 94]
const AMBER  = [245, 158, 11]

function rgb(arr) { return { r: arr[0], g: arr[1], b: arr[2] } }

function setFill(doc, arr)   { doc.setFillColor(...arr) }
function setDraw(doc, arr)   { doc.setDrawColor(...arr) }
function setTextColor(doc, arr) { doc.setTextColor(...arr) }
function setFont(doc, style = 'normal') { doc.setFont('helvetica', style) }

/** Dibuja un rectángulo redondeado relleno */
function roundRect(doc, x, y, w, h, r, fill) {
  setFill(doc, fill)
  doc.roundedRect(x, y, w, h, r, r, 'F')
}

/** Devuelve el texto truncado a maxWidth en las unidades del doc */
function truncate(doc, text, maxWidth) {
  if (!text) return ''
  const w = doc.getTextWidth(text)
  if (w <= maxWidth) return text
  let t = text
  while (doc.getTextWidth(t + '…') > maxWidth && t.length > 0) t = t.slice(0, -1)
  return t + '…'
}

/** Dibuja una línea separadora */
function hr(doc, y, x1 = 14, x2 = 196) {
  setDraw(doc, MID)
  doc.setLineWidth(0.2)
  doc.line(x1, y, x2, y)
  return y + 4
}

/** Agrega nueva página y devuelve y inicial */
function newPage(doc) {
  doc.addPage()
  return 20
}

/** Renderiza el encabezado de página (logo + org + fecha) */
function renderPageHeader(doc, orgName, dateStr) {
  // Fondo oscuro completo
  setFill(doc, DARK)
  doc.rect(0, 0, 210, 297, 'F')

  // Barra superior
  setFill(doc, BRAND)
  doc.rect(0, 0, 210, 22, 'F')

  setFont(doc, 'bold')
  doc.setFontSize(13)
  setTextColor(doc, WHITE)
  doc.text('OOH Planner', 14, 14)

  setFont(doc, 'normal')
  doc.setFontSize(8)
  setTextColor(doc, [199, 210, 254]) // indigo-200
  const rightX = 196
  doc.text(orgName, rightX, 9, { align: 'right' })
  doc.text(dateStr, rightX, 15, { align: 'right' })

  return 32 // y inicial del contenido
}

/** Bloque de datos de campaña (cliente, ciudad, fechas, budget) */
function renderCampaignInfo(doc, formData, y) {
  setFont(doc, 'bold')
  doc.setFontSize(16)
  setTextColor(doc, WHITE)
  doc.text(`Propuesta OOH — ${formData.clientName}`, 14, y)
  y += 7

  setFont(doc, 'normal')
  doc.setFontSize(9)
  setTextColor(doc, LIGHT)

  const left = [
    ['Cliente',  formData.clientName],
    ['Email',    formData.clientEmail || '—'],
    ['Ciudad',   formData.city],
  ]
  const right = [
    ['Inicio',       formData.startDate || '—'],
    ['Fin',          formData.endDate || '—'],
    ['Presupuesto',  formatCurrency(Number(formData.budget || 0))],
    ['Descuento',    formData.discountPct ? `${formData.discountPct}%` : 'Sin descuento'],
  ]

  const colW = 91
  left.forEach(([label, value], i) => {
    const row = y + i * 7
    setFont(doc, 'normal')
    setTextColor(doc, LIGHT)
    doc.text(label + ':', 14, row)
    setFont(doc, 'bold')
    setTextColor(doc, WHITE)
    doc.text(value, 50, row)
  })

  right.forEach(([label, value], i) => {
    const row = y + i * 7
    setFont(doc, 'normal')
    setTextColor(doc, LIGHT)
    doc.text(label + ':', 110, row)
    setFont(doc, 'bold')
    setTextColor(doc, WHITE)
    doc.text(value, 152, row)
  })

  y += Math.max(left.length, right.length) * 7 + 4
  return hr(doc, y)
}

/** Encabezado de opción (A o B) */
function renderOptionHeader(doc, option, label, y) {
  roundRect(doc, 14, y, 182, 10, 2, BRAND)
  setFont(doc, 'bold')
  doc.setFontSize(11)
  setTextColor(doc, WHITE)
  doc.text(`${label === 'A' ? '⚡' : '🎯'} ${option.label ?? `Opción ${label}`}`, 18, y + 7)
  y += 15

  // Rationale
  if (option.rationale) {
    setFont(doc, 'italic')
    doc.setFontSize(8.5)
    setTextColor(doc, [165, 180, 252]) // indigo-300
    const lines = doc.splitTextToSize(option.rationale, 178)
    doc.text(lines, 16, y)
    y += lines.length * 5 + 4
  }
  return y
}

/** Tabla de métricas clave (4 columnas) */
function renderMetrics(doc, metrics, y) {
  const cols = [
    { label: 'Impactos/mes', value: metrics.totalImpactsPerMonth
        ? `~${((metrics.totalImpactsPerMonth) / 1000).toFixed(0)}k` : '—' },
    { label: 'Alcance estim.', value: metrics.estimatedReach
        ? `~${((metrics.estimatedReach) / 1000).toFixed(0)}k` : '—' },
    { label: 'CPM estimado', value: metrics.estimatedCPM ? `$${metrics.estimatedCPM}` : '—' },
    { label: 'Tarifa lista', value: formatCurrency(metrics.totalRate ?? 0) },
  ]

  const colW = 45.5
  cols.forEach((col, i) => {
    const x = 14 + i * colW
    roundRect(doc, x, y, colW - 2, 18, 2, MID)
    setFont(doc, 'normal')
    doc.setFontSize(7)
    setTextColor(doc, LIGHT)
    doc.text(col.label, x + 2, y + 6)
    setFont(doc, 'bold')
    doc.setFontSize(10)
    setTextColor(doc, WHITE)
    doc.text(truncate(doc, col.value, colW - 4), x + 2, y + 15)
  })

  return y + 24
}

/** Desglose de precio */
function renderPriceBreakdown(doc, formData, totalListRate, y) {
  if (!totalListRate) return y
  const discount    = formData.discountPct ?? 0
  const discountAmt = Math.round(totalListRate * discount / 100)
  const clientTotal = totalListRate - discountAmt

  roundRect(doc, 14, y, 182, discount > 0 ? 26 : 18, 2, [30, 41, 59])
  setFont(doc, 'normal')
  doc.setFontSize(8)
  setTextColor(doc, LIGHT)
  doc.text('Precio de lista:', 18, y + 8)
  setTextColor(doc, [100, 116, 139])
  doc.text(formatCurrency(totalListRate), 190, y + 8, { align: 'right' })

  if (discount > 0) {
    setTextColor(doc, GREEN)
    setFont(doc, 'bold')
    doc.text(`Descuento ${discount}%:`, 18, y + 16)
    doc.text(`-${formatCurrency(discountAmt)}`, 190, y + 16, { align: 'right' })

    setTextColor(doc, WHITE)
    doc.setFontSize(10)
    doc.text('Total cliente:', 18, y + 24)
    doc.text(formatCurrency(clientTotal), 190, y + 24, { align: 'right' })
    return y + 32
  } else {
    setFont(doc, 'bold')
    setTextColor(doc, WHITE)
    doc.setFontSize(10)
    doc.text('Total cliente:', 18, y + 16)
    doc.text(formatCurrency(clientTotal), 190, y + 16, { align: 'right' })
    return y + 24
  }
}

/** Lista de carteles */
function renderSiteList(doc, sites, y, pageBottom = 270) {
  if (!sites?.length) return y

  setFont(doc, 'bold')
  doc.setFontSize(9)
  setTextColor(doc, LIGHT)
  doc.text(`Carteles seleccionados (${sites.length})`, 14, y)
  y += 6

  for (const site of sites) {
    const rowH = site.justification ? 20 : 14

    // Si no cabe en la página actual, nueva página
    if (y + rowH > pageBottom) {
      doc.addPage()
      setFill(doc, DARK)
      doc.rect(0, 0, 210, 297, 'F')
      y = 20
    }

    roundRect(doc, 14, y, 182, rowH, 2, [30, 41, 59])

    // Nombre + formato
    setFont(doc, 'bold')
    doc.setFontSize(8.5)
    setTextColor(doc, WHITE)
    doc.text(truncate(doc, site.name ?? '—', 100), 18, y + 7)

    const fmt = FORMAT_MAP[site.format]
    if (fmt) {
      setFont(doc, 'normal')
      doc.setFontSize(7)
      setTextColor(doc, LIGHT)
      doc.text(fmt.label, 190, y + 7, { align: 'right' })
    }

    // Dirección + tarifa
    setFont(doc, 'normal')
    doc.setFontSize(7.5)
    setTextColor(doc, LIGHT)
    doc.text(truncate(doc, site.address ?? '', 110), 18, y + 13)

    setFont(doc, 'bold')
    doc.setFontSize(7.5)
    setTextColor(doc, [165, 180, 252])
    doc.text(formatCurrency(site.rate ?? 0), 190, y + 13, { align: 'right' })

    if (site.justification) {
      setFont(doc, 'italic')
      doc.setFontSize(7)
      setTextColor(doc, [100, 116, 139])
      doc.text(`"${truncate(doc, site.justification, 170)}"`, 18, y + 19)
    }

    y += rowH + 2
  }
  return y + 4
}

/** Nota de mapa */
function renderMapNote(doc, y) {
  roundRect(doc, 14, y, 182, 10, 2, [30, 41, 59])
  setFont(doc, 'italic')
  doc.setFontSize(7.5)
  setTextColor(doc, LIGHT)
  doc.text('Ver mapa interactivo de esta opción en la plataforma OOH Planner.', 18, y + 7)
  return y + 14
}

/** Footer de cada página */
function renderFooter(doc, vendorName, pageNum, totalPages) {
  const y = 287
  setFont(doc, 'normal')
  doc.setFontSize(7)
  setTextColor(doc, [71, 85, 105]) // slate-600
  doc.text(`Generado por ${vendorName} · OOH Planner`, 14, y)
  doc.text(`Pág. ${pageNum} / ${totalPages}`, 196, y, { align: 'right' })
}

// ──────────────────────────────────────────────────────────────

export async function generateProposalPDF({ results, formData, profile, org }) {
  // Importación dinámica para no inflar el bundle principal
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })

  const orgName    = org?.name ?? 'OOH Planner'
  const vendorName = profile?.full_name ?? 'Vendedor'
  const today      = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // ── Página 1: info campaña + Opción A ─────────────────────
  let y = renderPageHeader(doc, orgName, today)
  y = renderCampaignInfo(doc, formData, y)

  const optionA = results?.optionA
  if (optionA) {
    y = renderOptionHeader(doc, optionA, 'A', y)
    y = renderMetrics(doc, optionA.metrics ?? {}, y)
    y += 4
    y = renderPriceBreakdown(doc, formData, optionA.metrics?.totalRate, y)
    y += 4
    y = renderMapNote(doc, y)
    y = renderSiteList(doc, optionA.sites, y)
  }

  // ── Página 2: Opción B ─────────────────────────────────────
  doc.addPage()
  setFill(doc, DARK)
  doc.rect(0, 0, 210, 297, 'F')
  y = 20

  // Mini header en página 2
  setFill(doc, BRAND)
  doc.rect(0, 0, 210, 10, 'F')
  setFont(doc, 'bold')
  doc.setFontSize(9)
  setTextColor(doc, WHITE)
  doc.text('OOH Planner', 14, 7)
  doc.setFontSize(8)
  setFont(doc, 'normal')
  setTextColor(doc, [199, 210, 254])
  doc.text(orgName, 196, 7, { align: 'right' })
  y = 18

  const optionB = results?.optionB
  if (optionB) {
    y = renderOptionHeader(doc, optionB, 'B', y)
    y = renderMetrics(doc, optionB.metrics ?? {}, y)
    y += 4
    y = renderPriceBreakdown(doc, formData, optionB.metrics?.totalRate, y)
    y += 4
    y = renderMapNote(doc, y)
    y = renderSiteList(doc, optionB.sites, y)
  }

  // ── Footers ───────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    renderFooter(doc, vendorName, p, totalPages)
  }

  // ── Descarga ──────────────────────────────────────────────
  const safeName = (formData.clientName ?? 'cliente').replace(/[^a-z0-9áéíóúñü\s]/gi, '').replace(/\s+/g, '_')
  const dateTag  = new Date().toISOString().slice(0, 10)
  doc.save(`Propuesta_${safeName}_${dateTag}.pdf`)
}
