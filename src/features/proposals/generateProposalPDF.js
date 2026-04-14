/**
 * generateProposalPDF
 * PDF completo de propuesta OOH con mapa estático (OpenStreetMap),
 * logo de empresa, listado de carteles, vendedor y validez 15 días.
 */

import { formatCurrency } from '../../lib/utils'
import { FORMAT_MAP } from '../../lib/constants'

const THEMES = {
  dark: {
    BG:           [15,  23,  42],
    SURFACE:      [30,  41,  59],
    SURFACE2:     [40,  50,  70],
    TEXT:         [248, 250, 252],
    TEXT2:        [148, 163, 184],
    TEXT3:        [100, 116, 139],
    ACCENT:       [99,  102, 241],
    GREEN:        [34,  197, 94],
    AMBER:        [245, 158, 11],
    HEADER_BG:    [99,  102, 241],
    HEADER_TEXT:  [248, 250, 252],
    CARD_BG:      [30,  41,  59],
    CARD_BORDER:  [51,  65,  85],
    LINE:         [51,  65,  85],
    FOOTER:       [71,  85,  105],
    PRICE_STRIKE: [120, 130, 150],
    WARNING_BG:   [45,  35,  10],
    WARNING_TEXT: [245, 158, 11],
    INFO_BG:      [20,  35,  55],
    INFO_TEXT:    [147, 197, 253],
    VENDOR_LINK:  [165, 180, 252],
    RATIONALE_BG: [20,  30,  55],
    RATIONALE_TEXT:[165, 180, 252],
    MANDATORY_BG: [80,  50,  10],
    JUSTIFY_TEXT: [90,  105, 130],
    SEPARATOR:    [40,  50,  70],
  },
  light: {
    BG:           [255, 255, 255],
    SURFACE:      [245, 245, 247],
    SURFACE2:     [235, 235, 240],
    TEXT:         [26,  26,  26],
    TEXT2:        [100, 100, 110],
    TEXT3:        [140, 140, 150],
    ACCENT:       [37,  99,  235],
    GREEN:        [22,  163, 74],
    AMBER:        [217, 119, 6],
    HEADER_BG:    [37,  99,  235],
    HEADER_TEXT:  [255, 255, 255],
    CARD_BG:      [245, 245, 247],
    CARD_BORDER:  [220, 220, 225],
    LINE:         [220, 220, 225],
    FOOTER:       [140, 140, 150],
    PRICE_STRIKE: [160, 160, 170],
    WARNING_BG:   [255, 243, 224],
    WARNING_TEXT: [180, 95,  6],
    INFO_BG:      [235, 245, 255],
    INFO_TEXT:    [37,  99,  235],
    VENDOR_LINK:  [37,  99,  235],
    RATIONALE_BG: [235, 240, 255],
    RATIONALE_TEXT:[37,  99,  235],
    MANDATORY_BG: [255, 243, 200],
    JUSTIFY_TEXT: [100, 110, 130],
    SEPARATOR:    [210, 215, 225],
  },
}
let T = THEMES.dark

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
  while (doc.getTextWidth(t + '...') > maxW && t.length > 0) t = t.slice(0, -1)
  return t + '...'
}

function sanitize(text) {
  if (!text) return ''
  return String(text)
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2194/g, '<->')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u26A0/g, '(!)')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
}

function hr(doc, y, x1 = 14, x2 = 196) {
  setDraw(doc, T.LINE)
  doc.setLineWidth(0.2)
  doc.line(x1, y, x2, y)
  return y + 5
}

function addPageBackground(doc) {
  setFill(doc, T.BG)
  doc.rect(0, 0, 210, 297, 'F')
}

function miniHeader(doc, orgName) {
  setFill(doc, T.HEADER_BG)
  doc.rect(0, 0, 210, 10, 'F')
  setFont(doc, 'bold')
  doc.setFontSize(8)
  setTC(doc, T.HEADER_TEXT)
  doc.text(sanitize(orgName), 14, 7)
}

function renderFooter(doc, vendorName, orgName, pageNum, totalPages) {
  setFont(doc, 'normal')
  doc.setFontSize(7)
  setTC(doc, T.FOOTER)
  doc.text(sanitize(`Generado por ${vendorName} - ${orgName}`), 14, 289)
  doc.text(`Pag. ${pageNum} / ${totalPages}`, 196, 289, { align: 'right' })
}

export async function fetchStaticMap(sites) {
  // Ya no se usa — el mapa se genera directo en jsPDF
  return null
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

function getImageDims(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

function renderCoverPage(doc, { formData, profile, org, logoBase64, generatedAt, validUntil, summaryData }) {
  addPageBackground(doc)

  const orgName    = org?.name ?? 'OOH Planner'
  const vendorName = profile?.full_name ?? 'Vendedor'

  setFill(doc, T.HEADER_BG)
  doc.rect(0, 0, 210, 40, 'F')

  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', 14, 6, 28, 28) } catch { /* continuar */ }
  }

  const textX = logoBase64 ? 48 : 14
  setFont(doc, 'bold'); doc.setFontSize(16); setTC(doc, T.HEADER_TEXT)
  doc.text(sanitize(orgName), textX, 18)
  setFont(doc, 'normal'); doc.setFontSize(9); setTC(doc, T.VENDOR_LINK)
  doc.text('Propuesta Publicitaria OOH', textX, 26)

  let y = 56
  setFont(doc, 'bold'); doc.setFontSize(20); setTC(doc, T.TEXT)
  doc.text('Propuesta OOH', 14, y)
  y += 10
  setFont(doc, 'normal'); doc.setFontSize(14); setTC(doc, T.ACCENT)
  doc.text(sanitize(formData.clientName ?? '-'), 14, y)
  y += 14
  y = hr(doc, y)

  const leftData = [
    ['Cliente',    sanitize(formData.clientName ?? '-')],
    ['Email',      sanitize(formData.clientEmail || '-')],
    ['Objetivo',   sanitize(formData.objective ?? '-')],
    ['Ciudades',   sanitize((formData.cities ?? []).join(', ') || '-')],
    ['Provincias', sanitize((formData.provinces ?? []).join(', ') || '-')],
  ]
  const rightData = [
    ['Inicio',       sanitize(formData.startDate ?? '-')],
    ['Fin',          sanitize(formData.endDate ?? '-')],
    ['Presupuesto',  formatCurrency(Number(formData.budget ?? 0))],
    ['Descuento',    formData.discountPct > 0 ? `${formData.discountPct}%` : 'Sin descuento'],
    ['Formatos',     ''],
  ]

  doc.setFontSize(9)
  leftData.forEach(([label, value], i) => {
    const row = y + i * 8
    setFont(doc, 'normal'); setTC(doc, T.TEXT2); doc.text(label + ':', 14, row)
    setFont(doc, 'bold'); setTC(doc, T.TEXT); doc.text(truncate(doc, value, 75), 52, row)
  })
  rightData.forEach(([label, value], i) => {
    const row = y + i * 8
    setFont(doc, 'normal'); setTC(doc, T.TEXT2); doc.text(label + ':', 112, row)
    setFont(doc, 'bold'); setTC(doc, T.TEXT); doc.text(truncate(doc, value, 65), 148, row)
  })

  // Formatos inline con bullet separator
  const fmtList = (formData.formats ?? []).map(f => FORMAT_MAP[f]?.label ?? f)
  if (fmtList.length > 0) {
    const fmtY = y + 4 * 8
    setFont(doc, 'normal'); doc.setFontSize(9); setTC(doc, T.TEXT2)
    doc.text('Formatos:', 112, fmtY)
    setFont(doc, 'bold'); doc.setFontSize(7); setTC(doc, T.TEXT)
    const fmtText = sanitize(fmtList.join(' · '))
    const fmtLines = doc.splitTextToSize(fmtText, 48)
    doc.text(fmtLines.slice(0, 2), 148, fmtY)
    if (fmtLines.length > 2) {
      doc.text('...', 148, fmtY + 8)
    }
  }

  y += Math.max(leftData.length, rightData.length) * 8 + 6
  y = hr(doc, y)

  // Vendor contact lines (phone, email, office_hours)
  const contactLines = [
    profile?.phone        ? `Tel: ${profile.phone}`        : null,
    profile?.email        ? profile.email                   : null,
    profile?.office_hours ? profile.office_hours            : null,
  ].filter(Boolean)

  const vendorBoxH = Math.max(32, 28 + contactLines.length * 7)

  roundRect(doc, 14, y, 182, vendorBoxH, 3, T.SURFACE)
  setFont(doc, 'bold'); doc.setFontSize(9); setTC(doc, T.TEXT2)
  doc.text('Preparado por:', 18, y + 8)
  setTC(doc, T.TEXT); doc.text(sanitize(vendorName), 18, y + 15)
  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, T.TEXT2)
  doc.text(sanitize(orgName), 18, y + 22)

  let vly = y + 29
  for (const line of contactLines) {
    setTC(doc, T.VENDOR_LINK)
    doc.text(sanitize(line), 18, vly)
    vly += 7
  }

  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, T.TEXT2)
  doc.text('Fecha de emision:', 112, y + 8)
  setFont(doc, 'bold'); setTC(doc, T.TEXT)
  doc.text(generatedAt, 112, y + 15)
  setFont(doc, 'normal'); setTC(doc, T.AMBER)
  doc.text(`Valida hasta: ${validUntil}`, 112, y + 22)
  y += vendorBoxH + 8

  roundRect(doc, 14, y, 182, 12, 2, T.WARNING_BG)
  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, T.WARNING_TEXT)
  doc.text('Esta propuesta tiene una validez de 15 dias corridos desde la fecha de emision.', 18, y + 8)

  // Resumen rapido en la parte inferior de la portada
  y += 16
  roundRect(doc, 14, y, 182, 32, 3, T.SURFACE)
  setFont(doc, 'bold'); doc.setFontSize(10); setTC(doc, T.TEXT2)
  doc.text('Resumen de inversion', 18, y + 9)

  setFont(doc, 'bold'); doc.setFontSize(16); setTC(doc, T.TEXT)
  const totalDisplay = formatCurrency(Number(formData.budget ?? 0))
  doc.text(totalDisplay, 18, y + 20)
  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, T.TEXT2)
  doc.text('Presupuesto total', 18, y + 26)

  const fmtLabels = sanitize(
    (formData.formats ?? []).map(f => FORMAT_MAP[f]?.label ?? f).join(' - ')
  )
  if (fmtLabels) {
    setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, T.VENDOR_LINK)
    doc.text(truncate(doc, fmtLabels, 100), 100, y + 20)
  }

  const dateRange = `${formData.startDate ?? '-'} al ${formData.endDate ?? '-'}`
  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, T.TEXT2)
  doc.text(dateRange, 100, y + 26)
  y += 32  // avanzar después del roundRect de 32mm

  // Métricas clave de la propuesta
  if (summaryData && y + 55 < 285) {
    y += 6

    setFont(doc, 'bold'); doc.setFontSize(9); setTC(doc, T.TEXT2)
    doc.text(sanitize(`Opcion: ${summaryData.optionTitle}`), 14, y)
    y += 7

    const metricW = 88
    const metricH = 20
    const metrics = [
      {
        label: 'Impactos / Contactos',
        value: Math.round(summaryData.totalImpacts).toLocaleString('es-AR'),
        sub: `${summaryData.digitalCount} digital + ${summaryData.physicalCount} fisico`,
      },
      {
        label: 'Inversion cliente',
        value: formatCurrency(summaryData.totalClient),
        sub: 'Con descuento aplicado',
      },
      {
        label: 'Soportes seleccionados',
        value: String(summaryData.totalSites),
        sub: 'Carteles en la pauta',
      },
      {
        label: 'CPM (costo por mil)',
        value: summaryData.cpm > 0 ? `$ ${Math.round(summaryData.cpm).toLocaleString('es-AR')}` : '-',
        sub: 'Eficiencia de la inversion',
      },
    ]

    for (let i = 0; i < metrics.length; i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      const mx = 14 + col * (metricW + 6)
      const my = y + row * (metricH + 3)

      if (my + metricH > 282) break

      roundRect(doc, mx, my, metricW, metricH, 2, T.SURFACE)

      setFont(doc, 'normal'); doc.setFontSize(7); setTC(doc, T.TEXT2)
      doc.text(metrics[i].label, mx + 4, my + 6)

      setFont(doc, 'bold'); doc.setFontSize(12); setTC(doc, T.TEXT)
      doc.text(metrics[i].value, mx + 4, my + 14)

      setFont(doc, 'normal'); doc.setFontSize(6); setTC(doc, T.TEXT3)
      doc.text(metrics[i].sub, mx + 4, my + 18)
    }
  }
}

async function renderOption(doc, {
  option, label, formData, orgName, mapBase64,
  occupiedIds = new Set(), mockupMap = {}, siteCarasMap = {},
}) {
  if (!option) return

  addPageBackground(doc)
  miniHeader(doc, orgName)

  let y = 18

  roundRect(doc, 14, y, 182, 12, 2, T.HEADER_BG)
  setFont(doc, 'bold'); doc.setFontSize(12); setTC(doc, T.HEADER_TEXT)
  doc.text(sanitize(`${label === 'A' ? 'A -' : 'B -'} ${option.title ?? `Opcion ${label}`}`), 18, y + 8.5)
  y += 18

  if (option.rationale) {
    roundRect(doc, 14, y, 182, 16, 2, T.RATIONALE_BG)
    setFont(doc, 'italic'); doc.setFontSize(8); setTC(doc, T.RATIONALE_TEXT)
    const lines = doc.splitTextToSize(sanitize(option.rationale), 174)
    doc.text(lines.slice(0, 2), 18, y + 7)
    y += 22
  }

  // Metricas separadas DOOH vs OFF
  const DIGITAL_FMT = new Set(['digital', 'urban_furniture_digital'])
  const digitalSites  = (option.sites ?? []).filter(s => DIGITAL_FMT.has(s.format) && !occupiedIds.has(s.id))
  const physicalSites = (option.sites ?? []).filter(s => !DIGITAL_FMT.has(s.format) && !occupiedIds.has(s.id))

  const doohImpacts   = digitalSites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0)
  const doohInversion = digitalSites.reduce((s, x) => s + (x.client_price ?? 0), 0)
  const offContactos  = physicalSites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0)
  const offInversion  = physicalSites.reduce((s, x) => s + (x.client_price ?? 0), 0)
  const totalInversion = doohInversion + offInversion

  function fmtN(n) {
    return Math.round(Number(n ?? 0)).toLocaleString('es-AR')
  }

  const kpiRows = []
  if (digitalSites.length > 0) {
    kpiRows.push(['DOOH', `Impactos: ${fmtN(doohImpacts)}`, `Inversion: ${formatCurrency(doohInversion)}`, `${digitalSites.length} pantalla${digitalSites.length > 1 ? 's' : ''}`])
  }
  if (physicalSites.length > 0) {
    kpiRows.push(['OFF', `Contactos: ${fmtN(offContactos)}`, `Inversion: ${formatCurrency(offInversion)}`, `${physicalSites.length} soporte${physicalSites.length > 1 ? 's' : ''}`])
  }
  kpiRows.push(['Total', formatCurrency(totalInversion), `Ppto: ${formatCurrency(Number(option.total_list_price ?? 0))}`, ''])

  const kpiH = 10
  kpiRows.forEach((row, ri) => {
    const rowY = y + ri * (kpiH + 2)
    roundRect(doc, 14, rowY, 182, kpiH, 2, T.SURFACE)
    setFont(doc, 'bold'); doc.setFontSize(7); setTC(doc, T.TEXT2)
    doc.text(row[0], 18, rowY + 7)
    setFont(doc, 'normal'); setTC(doc, T.TEXT)
    doc.text(row[1], 60, rowY + 7)
    doc.text(row[2], 110, rowY + 7)
    setTC(doc, T.TEXT2)
    doc.text(row[3], 176, rowY + 7, { align: 'right' })
  })
  y += kpiRows.length * (kpiH + 2) + 4

  // Desglose precio
  const discount    = formData.discountPct ?? 0
  const listTotal   = option.total_list_price ?? 0
  const clientTotal = option.total_client_price ?? 0
  const discountAmt = option.discount_amount ?? Math.round(listTotal * discount / 100)
  const remaining   = option.budget_remaining ?? 0
  const gap         = option.next_billboard_gap ?? 0

  if (listTotal > 0) {
    roundRect(doc, 14, y, 182, discount > 0 ? 28 : 18, 2, T.SURFACE)
    doc.setFontSize(8); setFont(doc, 'normal'); setTC(doc, T.TEXT2)
    doc.text('Precio de lista:', 18, y + 7)
    setFont(doc, 'bold'); setTC(doc, T.TEXT)
    doc.text(formatCurrency(listTotal), 192, y + 7, { align: 'right' })

    if (discount > 0) {
      setTC(doc, T.GREEN); setFont(doc, 'bold')
      doc.text(`Descuento ${discount}%:`, 18, y + 15)
      doc.text(`-${formatCurrency(discountAmt)}`, 192, y + 15, { align: 'right' })
      setTC(doc, T.TEXT); doc.setFontSize(10)
      doc.text('Total cliente:', 18, y + 24)
      doc.text(formatCurrency(clientTotal), 192, y + 24, { align: 'right' })
      y += 34
    } else {
      setFont(doc, 'bold'); setTC(doc, T.TEXT); doc.setFontSize(10)
      doc.text('Total cliente:', 18, y + 15)
      doc.text(formatCurrency(clientTotal), 192, y + 15, { align: 'right' })
      y += 24
    }

    if (remaining > 0) {
      doc.setFontSize(8); setFont(doc, 'normal'); setTC(doc, T.TEXT2)
      doc.text(`Presupuesto restante: ${formatCurrency(remaining)}`, 18, y)
      y += 6
    }
    if (gap > 0) {
      roundRect(doc, 14, y, 182, 10, 2, T.INFO_BG)
      doc.setFontSize(7.5); setTC(doc, T.INFO_TEXT)
      doc.text(`Con ${formatCurrency(gap)} mas podes agregar el siguiente cartel disponible.`, 18, y + 7)
      y += 14
    }
    y += 4
  }

  // Carteles
  const allSites   = option.sites ?? []
  const availSites = allSites
    .filter(s => !occupiedIds.has(s.id))
    .sort((a, b) => {
      const aD = DIGITAL_FMT.has(a.format) ? 0 : 1
      const bD = DIGITAL_FMT.has(b.format) ? 0 : 1
      if (aD !== bD) return aD - bD
      return (b.client_price ?? 0) - (a.client_price ?? 0)
    })
  const occupiedCount = allSites.length - availSites.length

  // Verificar espacio para el titulo + al menos el primer cartel
  const firstSite = availSites[0]
  const firstHasMockup = !!(mockupMap[firstSite?.id])
  const minSpaceForFirst = firstHasMockup ? 85 : 30

  if (y + minSpaceForFirst > 278) {
    doc.addPage()
    addPageBackground(doc)
    miniHeader(doc, orgName)
    y = 18
  }

  setFont(doc, 'bold'); doc.setFontSize(9); setTC(doc, T.TEXT2)
  doc.text(`Carteles seleccionados (${availSites.length})`, 14, y)
  y += 6

  for (const site of availSites) {
    const mockupDataUrl = mockupMap[site.id] ?? null
    const siteData = siteCarasMap[site.id] ?? null
    const photoUrl = mockupDataUrl ?? siteData?.photoUrl ?? site.photo_url ?? null
    const hasMockup = !!mockupDataUrl
    const hasPhoto = !!photoUrl
    const hasJ = !!site.justification

    if (hasMockup) {
      // ── MOCKUP LAYOUT: imagen izquierda + info derecha ──

      let imgData = photoUrl
      if (!photoUrl.startsWith('data:')) {
        imgData = await fetchLogoBase64(photoUrl)
      }

      // Calcular dimensiones proporcionales de la imagen
      const IMG_MAX_W = 65  // mm
      const IMG_MAX_H = 48  // mm
      let imgW = IMG_MAX_W
      let imgH = IMG_MAX_H

      if (imgData) {
        const dims = await getImageDims(imgData)
        if (dims && dims.w > 0 && dims.h > 0) {
          const ratio = dims.w / dims.h
          if (ratio >= IMG_MAX_W / IMG_MAX_H) {
            imgW = IMG_MAX_W
            imgH = IMG_MAX_W / ratio
          } else {
            imgH = IMG_MAX_H
            imgW = IMG_MAX_H * ratio
          }
        }
      }

      // Altura de la card: la mayor entre la imagen y el texto
      const textBlockH = hasJ ? 42 : 35
      const rowH = Math.max(imgH + 4, textBlockH)

      if (y + rowH > 278) {
        doc.addPage()
        addPageBackground(doc)
        miniHeader(doc, orgName)
        y = 18
      }

      roundRect(doc, 14, y, 182, rowH, 2, T.CARD_BG)

      // Imagen mockup a la izquierda
      const imgY = y + (rowH - imgH) / 2  // centrar verticalmente
      if (imgData) {
        try {
          doc.addImage(imgData, 'JPEG', 16, imgY, imgW, imgH)
        } catch { /* ignorar */ }
      }

      // Badge MOCKUP
      const badgeY = imgY + imgH - 5
      roundRect(doc, 16, badgeY, 18, 5, 1, T.ACCENT)
      setFont(doc, 'bold')
      doc.setFontSize(4.5)
      setTC(doc, T.HEADER_TEXT)
      doc.text('MOCKUP', 17.5, badgeY + 3.5)

      // ── Info a la derecha ──
      const textX = 16 + imgW + 4  // margen despues de la imagen
      const rightW = 192 - textX   // ancho disponible para texto
      let tY = y + 5

      // Linea 1: nombre
      setFont(doc, 'bold'); doc.setFontSize(9); setTC(doc, T.TEXT)
      doc.text(truncate(doc, sanitize(site.name ?? '-'), rightW - 40), textX, tY)

      // Formato (alineado derecha)
      const fmt = FORMAT_MAP[site.format]
      if (fmt) {
        setFont(doc, 'normal'); doc.setFontSize(7); setTC(doc, T.TEXT2)
        doc.text(fmt.label, 192, tY, { align: 'right' })
      }

      // Badge obligatorio
      if (site.is_mandatory) {
        const mandX = 192 - 26 - (fmt ? 35 : 0)
        roundRect(doc, mandX, tY - 3, 24, 5, 1, T.MANDATORY_BG)
        setFont(doc, 'bold'); doc.setFontSize(5); setTC(doc, T.AMBER)
        doc.text('OBLIGATORIO', mandX + 1, tY + 0.5)
      }

      tY += 5.5

      // Linea 2: direccion
      setFont(doc, 'normal'); doc.setFontSize(7.5); setTC(doc, T.TEXT2)
      doc.text(truncate(doc, sanitize(site.address ?? ''), rightW - 5), textX, tY)
      tY += 6

      // Specs del cartel
      const specs = siteCarasMap[site.id]
      const specParts = []
      if (specs?.width && specs?.height) specParts.push(`${specs.width} x ${specs.height} ft`)
      if (specs?.illuminated) specParts.push('Iluminado')
      if (specParts.length > 0) {
        setFont(doc, 'normal'); doc.setFontSize(6.5); setTC(doc, T.INFO_TEXT)
        doc.text(specParts.join(' | '), textX, tY)
        tY += 4
      }

      // Separador
      setDraw(doc, T.SEPARATOR)
      doc.setLineWidth(0.15)
      doc.line(textX, tY, textX + rightW - 5, tY)
      tY += 4

      // Metricas: impactos/contactos
      const isDigital = DIGITAL_FMT.has(site.format)
      const impacts = site.monthly_impacts ?? 0
      if (impacts > 0) {
        setFont(doc, 'normal'); doc.setFontSize(7); setTC(doc, T.TEXT2)
        doc.text(isDigital ? 'Impactos/mes:' : 'Contactos/mes:', textX, tY)
        setFont(doc, 'bold'); setTC(doc, T.TEXT)
        doc.text(Math.round(impacts).toLocaleString('es-AR'), textX + 28, tY)
        tY += 5
      }

      // Precio de lista y precio cliente
      const listPrice = site.list_price ?? 0
      if (listPrice > 0) {
        setFont(doc, 'normal'); doc.setFontSize(7); setTC(doc, T.TEXT2)
        doc.text('Lista:', textX, tY)
        setFont(doc, 'normal'); setTC(doc, T.PRICE_STRIKE)
        doc.text(formatCurrency(listPrice), textX + 28, tY)

        const precioCliente = site.client_price ?? listPrice
        setFont(doc, 'bold'); doc.setFontSize(9); setTC(doc, T.GREEN)
        doc.text(formatCurrency(precioCliente), 192, tY, { align: 'right' })
        tY += 6
      } else {
        const precioCliente = site.client_price ?? site.list_price ?? 0
        setFont(doc, 'bold'); doc.setFontSize(9); setTC(doc, T.GREEN)
        doc.text(formatCurrency(precioCliente), 192, tY, { align: 'right' })
        tY += 6
      }

      // Justificacion
      if (hasJ) {
        setFont(doc, 'italic'); doc.setFontSize(6.5); setTC(doc, T.JUSTIFY_TEXT)
        const justLines = doc.splitTextToSize(sanitize(`"${site.justification}"`), rightW - 5)
        doc.text(justLines.slice(0, 2), textX, tY)
      }

      y += rowH + 2

    } else {
      // ── LAYOUT NORMAL: foto izquierda o sin foto ──
      const PHOTO_W = hasPhoto ? 32 : 0
      const PHOTO_H = 22
      const hasImpacts = (site.monthly_impacts ?? 0) > 0
      const rowH = hasPhoto
        ? Math.max(PHOTO_H + 4, hasJ ? 35 : (hasImpacts ? 28 : 26))
        : (hasJ ? 28 : (hasImpacts ? 22 : 19))

      if (y + rowH > 278) {
        doc.addPage()
        addPageBackground(doc)
        miniHeader(doc, orgName)
        y = 18
      }

      roundRect(doc, 14, y, 182, rowH, 2, T.CARD_BG)

      if (hasPhoto) {
        try {
          let imgData = photoUrl
          if (!photoUrl.startsWith('data:')) {
            imgData = await fetchLogoBase64(photoUrl)
          }
          if (imgData) {
            doc.addImage(imgData, 'JPEG', 16, y + 2, PHOTO_W, PHOTO_H)
          }
        } catch { /* ignorar */ }
      }

      const textX = 18 + PHOTO_W
      const textMaxW = hasPhoto ? 95 : (site.is_mandatory ? 110 : 130)

      setFont(doc, 'bold'); doc.setFontSize(8.5); setTC(doc, T.TEXT)
      doc.text(truncate(doc, sanitize(site.name ?? '-'), textMaxW), textX, y + 7)

      if (site.is_mandatory) {
        roundRect(doc, 148, y + 2, 26, 6, 1, T.MANDATORY_BG)
        setFont(doc, 'bold'); doc.setFontSize(6); setTC(doc, T.AMBER)
        doc.text('OBLIGATORIO', 149, y + 6.5)
      }

      const fmt = FORMAT_MAP[site.format]
      if (fmt) {
        setFont(doc, 'normal'); doc.setFontSize(7); setTC(doc, T.TEXT2)
        doc.text(fmt.label, 192, y + 7, { align: 'right' })
      }

      setFont(doc, 'normal'); doc.setFontSize(7.5); setTC(doc, T.TEXT2)
      doc.text(truncate(doc, sanitize(site.address ?? ''), hasPhoto ? 95 : 120), textX, y + 14)

      const precioCliente = site.client_price ?? site.list_price ?? 0
      setFont(doc, 'bold'); doc.setFontSize(7.5); setTC(doc, T.GREEN)
      doc.text(formatCurrency(precioCliente), 192, y + 14, { align: 'right' })

      // Impactos/contactos (si existen)
      const impacts2 = site.monthly_impacts ?? 0
      if (impacts2 > 0) {
        const isDigital2 = DIGITAL_FMT.has(site.format)
        setFont(doc, 'normal'); doc.setFontSize(6.5); setTC(doc, T.TEXT2)
        doc.text(
          `${isDigital2 ? 'Impactos' : 'Contactos'}: ${Math.round(impacts2).toLocaleString('es-AR')}`,
          textX, y + (hasPhoto ? 19 : 12)
        )
      }

      if (hasJ) {
        setFont(doc, 'italic'); doc.setFontSize(7); setTC(doc, T.JUSTIFY_TEXT)
        doc.text(sanitize(`"${truncate(doc, site.justification, hasPhoto ? 140 : 170)}"`), textX, y + 21)
      }

      y += rowH + 1.5
    }
  }

  if (occupiedCount > 0) {
    if (y + 14 > 285) {
      doc.addPage()
      addPageBackground(doc)
      miniHeader(doc, orgName)
      y = 18
    }
    roundRect(doc, 14, y, 182, 10, 2, T.WARNING_BG)
    setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, T.WARNING_TEXT)
    doc.text(
      `(!) ${occupiedCount} cartel${occupiedCount > 1 ? 'es' : ''} adicional${occupiedCount > 1 ? 'es' : ''} excluido${occupiedCount > 1 ? 's' : ''} por estar ocupado${occupiedCount > 1 ? 's' : ''} en las fechas solicitadas.`,
      23, y + 7
    )
    y += 14
  }
}

export async function generateProposalPDF({
  results, formData, profile, org,
  mapA = null, mapB = null,
  activeOption = 'A',
  occupiedSiteIds = new Set(),
  artworkMap = {},
  formatToArt = {},
  mockupMap = {},
  siteCarasMap = {},
  pdfTheme = 'dark',
}) {
  T = THEMES[pdfTheme] ?? THEMES.dark
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

  const selectedOpt = activeOption === 'B' ? results?.optionB : results?.optionA
  const DIGITAL_SET_COVER = new Set(['digital', 'urban_furniture_digital'])
  const coverSites = selectedOpt?.sites ?? []
  const availCoverSites = coverSites.filter(s => !occupiedSiteIds.has(s.id))
  const coverDigital = availCoverSites.filter(s => DIGITAL_SET_COVER.has(s.format))
  const coverPhysical = availCoverSites.filter(s => !DIGITAL_SET_COVER.has(s.format))
  const summaryData = {
    totalSites: availCoverSites.length,
    digitalCount: coverDigital.length,
    physicalCount: coverPhysical.length,
    totalImpacts: availCoverSites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0),
    totalClient: selectedOpt?.total_client_price ?? 0,
    cpm: 0,
    optionTitle: sanitize(selectedOpt?.title ?? 'Maximo Alcance'),
  }

  // Calcular CPM manualmente
  const totalImp = summaryData.totalImpacts
  if (totalImp > 0 && summaryData.totalClient > 0) {
    summaryData.cpm = Math.round(summaryData.totalClient / (totalImp / 1000))
  }

  renderCoverPage(doc, { formData, profile, org, logoBase64, generatedAt, validUntil, summaryData })

  const selectedOption = activeOption === 'B' ? results?.optionB : results?.optionA
  const selectedMap    = activeOption === 'B' ? mapB : mapA
  const selectedLabel  = activeOption === 'B' ? 'B' : 'A'
  doc.addPage()
  await renderOption(doc, {
    option: selectedOption,
    label: selectedLabel,
    formData,
    orgName,
    mapBase64: selectedMap,
    occupiedIds: occupiedSiteIds,
    mockupMap,
    siteCarasMap,
  })

  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    renderFooter(doc, vendorName, orgName, p, totalPages)
  }

  const safeName = (formData.clientName ?? 'cliente')
    .replace(/[^a-z0-9áéíóúñü\s]/gi, '').replace(/\s+/g, '_')
  doc.save(`Propuesta_${safeName}_${now.toISOString().slice(0, 10)}.pdf`)
}
