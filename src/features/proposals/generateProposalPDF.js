/**
 * generateProposalPDF
 * PDF completo de propuesta OOH con mapa estático (OpenStreetMap),
 * logo de empresa, listado de carteles, vendedor y validez 15 días.
 */

import { formatCurrency } from '../../lib/utils'
import { FORMAT_MAP } from '../../lib/constants'

const BRAND   = [99, 102, 241]
const DARK    = [15,  23,  42]
const MID     = [51,  65,  85]
const LIGHT   = [148, 163, 184]
const WHITE   = [248, 250, 252]
const GREEN   = [34, 197, 94]
const AMBER   = [245, 158, 11]
const SURFACE = [30, 41, 59]

function setFill(doc, arr)          { doc.setFillColor(...arr) }
function setDraw(doc, arr)          { doc.setDrawColor(...arr) }
function setTC(doc, arr)            { doc.setTextColor(...arr) }
function setFont(doc, s = 'normal') { doc.setFont('helvetica', s) }

function roundRect(doc, x, y, w, h, r, fill) {
  setFill(doc, fill)
  doc.roundedRect(x, y, w, h, r, r, 'F')
}

function truncate(doc, text, maxW) {
  if (!text) return ''
  const s = String(text)
  if (doc.getTextWidth(s) <= maxW) return s
  let t = s
  while (doc.getTextWidth(t + '…') > maxW && t.length > 0) t = t.slice(0, -1)
  return t + '…'
}

function hr(doc, y, x1 = 14, x2 = 196) {
  setDraw(doc, MID)
  doc.setLineWidth(0.2)
  doc.line(x1, y, x2, y)
  return y + 5
}

function addPageBackground(doc) {
  setFill(doc, DARK)
  doc.rect(0, 0, 210, 297, 'F')
}

function miniHeader(doc, orgName) {
  setFill(doc, BRAND)
  doc.rect(0, 0, 210, 10, 'F')
  setFont(doc, 'bold')
  doc.setFontSize(8)
  setTC(doc, WHITE)
  doc.text('OOH Planner', 14, 7)
  setFont(doc, 'normal')
  setTC(doc, [199, 210, 254])
  doc.text(orgName, 196, 7, { align: 'right' })
}

function renderFooter(doc, vendorName, orgName, pageNum, totalPages) {
  setFont(doc, 'normal')
  doc.setFontSize(7)
  setTC(doc, [71, 85, 105])
  doc.text(`Generado por ${vendorName} · ${orgName}`, 14, 289)
  doc.text(`Pág. ${pageNum} / ${totalPages}`, 196, 289, { align: 'right' })
}

export async function fetchStaticMap(sites) {
  try {
    const validSites = (sites ?? []).filter(s =>
      s.latitude != null && s.longitude != null &&
      !isNaN(Number(s.latitude)) && !isNaN(Number(s.longitude))
    )
    if (validSites.length === 0) return null

    const avgLat = validSites.reduce((s, x) => s + Number(x.latitude), 0) / validSites.length
    const avgLon = validSites.reduce((s, x) => s + Number(x.longitude), 0) / validSites.length
    const markers = validSites
      .map(s => `${Number(s.latitude).toFixed(6)},${Number(s.longitude).toFixed(6)},red-pushpin`)
      .join('|')

    const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${avgLat.toFixed(6)},${avgLon.toFixed(6)}&zoom=12&size=560x220&markers=${markers}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) return null
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) return null

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function fetchLogoBase64(logoUrl) {
  try {
    if (!logoUrl) return null
    const response = await fetch(logoUrl)
    if (!response.ok) return null
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function renderCoverPage(doc, { formData, profile, org, logoBase64, generatedAt, validUntil }) {
  addPageBackground(doc)

  const orgName    = org?.name ?? 'OOH Planner'
  const vendorName = profile?.full_name ?? 'Vendedor'

  setFill(doc, BRAND)
  doc.rect(0, 0, 210, 40, 'F')

  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', 14, 6, 28, 28) } catch { /* continuar */ }
  }

  const textX = logoBase64 ? 48 : 14
  setFont(doc, 'bold'); doc.setFontSize(16); setTC(doc, WHITE)
  doc.text(orgName, textX, 18)
  setFont(doc, 'normal'); doc.setFontSize(9); setTC(doc, [199, 210, 254])
  doc.text('Propuesta Publicitaria OOH', textX, 26)

  let y = 56
  setFont(doc, 'bold'); doc.setFontSize(20); setTC(doc, WHITE)
  doc.text('Propuesta OOH', 14, y)
  y += 10
  setFont(doc, 'normal'); doc.setFontSize(14); setTC(doc, [165, 180, 252])
  doc.text(formData.clientName ?? '—', 14, y)
  y += 14
  y = hr(doc, y)

  const leftData = [
    ['Cliente',    formData.clientName ?? '—'],
    ['Email',      formData.clientEmail || '—'],
    ['Objetivo',   formData.objective ?? '—'],
    ['Ciudades',   (formData.cities ?? []).join(', ') || '—'],
    ['Provincias', (formData.provinces ?? []).join(', ') || '—'],
  ]
  const rightData = [
    ['Inicio',       formData.startDate ?? '—'],
    ['Fin',          formData.endDate ?? '—'],
    ['Presupuesto',  formatCurrency(Number(formData.budget ?? 0))],
    ['Descuento',    formData.discountPct > 0 ? `${formData.discountPct}%` : 'Sin descuento'],
    ['Formatos',     (formData.formats ?? []).map(f => FORMAT_MAP[f]?.label ?? f).join(', ') || '—'],
  ]

  doc.setFontSize(9)
  leftData.forEach(([label, value], i) => {
    const row = y + i * 8
    setFont(doc, 'normal'); setTC(doc, LIGHT); doc.text(label + ':', 14, row)
    setFont(doc, 'bold'); setTC(doc, WHITE); doc.text(truncate(doc, value, 75), 52, row)
  })
  rightData.forEach(([label, value], i) => {
    const row = y + i * 8
    setFont(doc, 'normal'); setTC(doc, LIGHT); doc.text(label + ':', 112, row)
    setFont(doc, 'bold'); setTC(doc, WHITE); doc.text(truncate(doc, value, 65), 148, row)
  })

  y += Math.max(leftData.length, rightData.length) * 8 + 6
  y = hr(doc, y)

  // Vendor contact lines (phone, email, office_hours)
  const contactLines = [
    profile?.phone        ? `Tel: ${profile.phone}`        : null,
    profile?.email        ? profile.email                   : null,
    profile?.office_hours ? profile.office_hours            : null,
  ].filter(Boolean)

  const vendorBoxH = Math.max(32, 28 + contactLines.length * 7)

  roundRect(doc, 14, y, 182, vendorBoxH, 3, SURFACE)
  setFont(doc, 'bold'); doc.setFontSize(9); setTC(doc, LIGHT)
  doc.text('Preparado por:', 18, y + 8)
  setTC(doc, WHITE); doc.text(vendorName, 18, y + 15)
  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, LIGHT)
  doc.text(orgName, 18, y + 22)

  let vly = y + 29
  for (const line of contactLines) {
    setTC(doc, [165, 180, 252])
    doc.text(line, 18, vly)
    vly += 7
  }

  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, LIGHT)
  doc.text('Fecha de emisión:', 112, y + 8)
  setFont(doc, 'bold'); setTC(doc, WHITE)
  doc.text(generatedAt, 112, y + 15)
  setFont(doc, 'normal'); setTC(doc, AMBER)
  doc.text(`Válida hasta: ${validUntil}`, 112, y + 22)
  y += vendorBoxH + 8

  roundRect(doc, 14, y, 182, 12, 2, [45, 35, 10])
  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, AMBER)
  doc.text('Esta propuesta tiene una validez de 15 días corridos desde la fecha de emisión.', 18, y + 8)
}

async function renderOption(doc, { option, label, formData, orgName, mapBase64, occupiedIds = new Set() }) {
  if (!option) return

  addPageBackground(doc)
  miniHeader(doc, orgName)

  let y = 18

  roundRect(doc, 14, y, 182, 12, 2, BRAND)
  setFont(doc, 'bold'); doc.setFontSize(12); setTC(doc, WHITE)
  doc.text(`${label === 'A' ? 'A -' : 'B -'} ${option.title ?? `Opción ${label}`}`, 18, y + 8.5)
  y += 18

  if (option.rationale) {
    roundRect(doc, 14, y, 182, 16, 2, [20, 30, 55])
    setFont(doc, 'italic'); doc.setFontSize(8); setTC(doc, [165, 180, 252])
    const lines = doc.splitTextToSize(option.rationale, 174)
    doc.text(lines.slice(0, 2), 18, y + 7)
    y += 22
  }

  // Métricas
  const metrics = [
    { label: 'Impactos/mes',    value: option.total_impacts    ? `~${(option.total_impacts / 1000).toFixed(0)}k`   : '—' },
    { label: 'Alcance estimado',value: option.estimated_reach  ? `~${(option.estimated_reach / 1000).toFixed(0)}k` : '—' },
    { label: 'CPM estimado',    value: option.cpm              ? `$${option.cpm}`                                   : '—' },
    { label: 'Total cliente',   value: formatCurrency(option.total_client_price ?? 0) },
  ]
  const mW = 44
  metrics.forEach((m, i) => {
    const x = 14 + i * (mW + 1)
    roundRect(doc, x, y, mW, 18, 2, SURFACE)
    setFont(doc, 'normal'); doc.setFontSize(7); setTC(doc, LIGHT)
    doc.text(m.label, x + 2, y + 6)
    setFont(doc, 'bold'); doc.setFontSize(9); setTC(doc, WHITE)
    doc.text(truncate(doc, m.value, mW - 4), x + 2, y + 15)
  })
  y += 24

  // Desglose precio
  const discount    = formData.discountPct ?? 0
  const listTotal   = option.total_list_price ?? 0
  const clientTotal = option.total_client_price ?? 0
  const discountAmt = option.discount_amount ?? Math.round(listTotal * discount / 100)
  const remaining   = option.budget_remaining ?? 0
  const gap         = option.next_billboard_gap ?? 0

  if (listTotal > 0) {
    roundRect(doc, 14, y, 182, discount > 0 ? 28 : 18, 2, SURFACE)
    doc.setFontSize(8); setFont(doc, 'normal'); setTC(doc, LIGHT)
    doc.text('Precio de lista:', 18, y + 7)
    setFont(doc, 'bold'); setTC(doc, WHITE)
    doc.text(formatCurrency(listTotal), 192, y + 7, { align: 'right' })

    if (discount > 0) {
      setTC(doc, GREEN); setFont(doc, 'bold')
      doc.text(`Descuento ${discount}%:`, 18, y + 15)
      doc.text(`-${formatCurrency(discountAmt)}`, 192, y + 15, { align: 'right' })
      setTC(doc, WHITE); doc.setFontSize(10)
      doc.text('Total cliente:', 18, y + 24)
      doc.text(formatCurrency(clientTotal), 192, y + 24, { align: 'right' })
      y += 34
    } else {
      setFont(doc, 'bold'); setTC(doc, WHITE); doc.setFontSize(10)
      doc.text('Total cliente:', 18, y + 15)
      doc.text(formatCurrency(clientTotal), 192, y + 15, { align: 'right' })
      y += 24
    }

    if (remaining > 0) {
      doc.setFontSize(8); setFont(doc, 'normal'); setTC(doc, LIGHT)
      doc.text(`Presupuesto restante: ${formatCurrency(remaining)}`, 18, y)
      y += 6
    }
    if (gap > 0) {
      roundRect(doc, 14, y, 182, 10, 2, [20, 35, 55])
      doc.setFontSize(7.5); setTC(doc, [147, 197, 253])
      doc.text(`Con ${formatCurrency(gap)} más podés agregar el siguiente cartel disponible.`, 18, y + 7)
      y += 14
    }
    y += 4
  }

  // Mapa
  if (mapBase64) {
    try {
      doc.addImage(mapBase64, 'JPEG', 14, y, 182, 52)
      y += 56
    } catch {
      try {
        doc.addImage(mapBase64, 'PNG', 14, y, 182, 52)
        y += 56
      } catch {
        y += 2
      }
    }
  }

  // Carteles
  const allSites      = option.sites ?? []
  const availSites    = allSites.filter(s => !occupiedIds.has(s.id))
  const occupiedCount = allSites.length - availSites.length

  setFont(doc, 'bold'); doc.setFontSize(9); setTC(doc, LIGHT)
  doc.text(`Carteles seleccionados (${availSites.length})`, 14, y)
  y += 6

  for (const site of availSites) {
    const hasPhoto = !!site.photo_url
    const hasJ     = !!site.justification
    const PHOTO_W  = hasPhoto ? 32 : 0
    const PHOTO_H  = 22
    const rowH     = hasPhoto
      ? Math.max(PHOTO_H + 4, hasJ ? 32 : 26)
      : (hasJ ? 26 : 19)

    if (y + rowH > 278) {
      doc.addPage()
      addPageBackground(doc)
      miniHeader(doc, orgName)
      y = 18
    }

    roundRect(doc, 14, y, 182, rowH, 2, SURFACE)

    // Foto (si existe)
    if (hasPhoto) {
      try {
        const photoB64 = await fetchLogoBase64(site.photo_url)
        if (photoB64) {
          doc.addImage(photoB64, 'JPEG', 16, y + 2, PHOTO_W, PHOTO_H)
        }
      } catch { /* ignorar si falla */ }
    }

    const textX    = 18 + PHOTO_W
    const textMaxW = hasPhoto ? 95 : (site.is_mandatory ? 110 : 130)

    // Nombre
    setFont(doc, 'bold'); doc.setFontSize(8.5); setTC(doc, WHITE)
    doc.text(truncate(doc, site.name ?? '—', textMaxW), textX, y + 7)

    // Badge obligatorio
    if (site.is_mandatory) {
      roundRect(doc, 148, y + 2, 26, 6, 1, [80, 50, 10])
      setFont(doc, 'bold'); doc.setFontSize(6); setTC(doc, AMBER)
      doc.text('OBLIGATORIO', 149, y + 6.5)
    }

    // Formato
    const fmt = FORMAT_MAP[site.format]
    if (fmt) {
      setFont(doc, 'normal'); doc.setFontSize(7); setTC(doc, LIGHT)
      doc.text(fmt.label, 192, y + 7, { align: 'right' })
    }

    // Dirección
    setFont(doc, 'normal'); doc.setFontSize(7.5); setTC(doc, LIGHT)
    doc.text(truncate(doc, site.address ?? '', hasPhoto ? 95 : 120), textX, y + 14)

    // Precio cliente
    const precioCliente = site.client_price ?? site.list_price ?? 0
    setFont(doc, 'bold'); doc.setFontSize(7.5); setTC(doc, GREEN)
    doc.text(formatCurrency(precioCliente), 192, y + 14, { align: 'right' })

    // Justificación
    if (hasJ) {
      setFont(doc, 'italic'); doc.setFontSize(7); setTC(doc, [100, 116, 139])
      doc.text(`"${truncate(doc, site.justification, hasPhoto ? 140 : 170)}"`, textX, y + 21)
    }

    y += rowH + 2
  }

  if (occupiedCount > 0) {
    if (y + 14 > 278) {
      doc.addPage()
      addPageBackground(doc)
      miniHeader(doc, orgName)
      y = 18
    }
    roundRect(doc, 14, y, 182, 12, 2, [45, 35, 10])
    setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, AMBER)
    doc.text(
      `⚠ ${occupiedCount} cartel${occupiedCount > 1 ? 'es' : ''} adicional${occupiedCount > 1 ? 'es' : ''} excluido${occupiedCount > 1 ? 's' : ''} por estar ocupado${occupiedCount > 1 ? 's' : ''} en las fechas solicitadas.`,
      18, y + 8
    )
    y += 16
  }
}

export async function generateProposalPDF({ results, formData, profile, org, mapA = null, mapB = null, activeOption = 'A', occupiedSiteIds = new Set() }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })

  const orgName    = org?.name ?? 'OOH Planner'
  const vendorName = profile?.full_name ?? 'Vendedor'

  const now = new Date()
  const generatedAt = now.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const validDate = new Date(now)
  validDate.setDate(validDate.getDate() + 15)
  const validUntil = validDate.toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const logoBase64 = await fetchLogoBase64(org?.logo_url)

  renderCoverPage(doc, { formData, profile, org, logoBase64, generatedAt, validUntil })

  const selectedOption = activeOption === 'B' ? results?.optionB : results?.optionA
  const selectedMap    = activeOption === 'B' ? mapB : mapA
  const selectedLabel  = activeOption === 'B' ? 'B' : 'A'
  doc.addPage()
  await renderOption(doc, { option: selectedOption, label: selectedLabel, formData, orgName, vendorName, mapBase64: selectedMap, occupiedIds: occupiedSiteIds })

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    renderFooter(doc, vendorName, orgName, p, totalPages)
  }

  const safeName = (formData.clientName ?? 'cliente')
    .replace(/[^a-z0-9áéíóúñü\s]/gi, '').replace(/\s+/g, '_')
  doc.save(`Propuesta_${safeName}_${now.toISOString().slice(0, 10)}.pdf`)
}
