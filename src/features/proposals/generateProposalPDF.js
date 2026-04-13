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
  doc.text(sanitize(orgName), 196, 7, { align: 'right' })
}

function renderFooter(doc, vendorName, orgName, pageNum, totalPages) {
  setFont(doc, 'normal')
  doc.setFontSize(7)
  setTC(doc, [71, 85, 105])
  doc.text(sanitize(`Generado por ${vendorName} - ${orgName}`), 14, 289)
  doc.text(`Pag. ${pageNum} / ${totalPages}`, 196, 289, { align: 'right' })
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

function getImageDims(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
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
  doc.text(sanitize(orgName), textX, 18)
  setFont(doc, 'normal'); doc.setFontSize(9); setTC(doc, [199, 210, 254])
  doc.text('Propuesta Publicitaria OOH', textX, 26)

  let y = 56
  setFont(doc, 'bold'); doc.setFontSize(20); setTC(doc, WHITE)
  doc.text('Propuesta OOH', 14, y)
  y += 10
  setFont(doc, 'normal'); doc.setFontSize(14); setTC(doc, [165, 180, 252])
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
    ['Formatos',     sanitize((formData.formats ?? []).map(f => FORMAT_MAP[f]?.label ?? f).join(', ') || '-')],
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
  setTC(doc, WHITE); doc.text(sanitize(vendorName), 18, y + 15)
  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, LIGHT)
  doc.text(sanitize(orgName), 18, y + 22)

  let vly = y + 29
  for (const line of contactLines) {
    setTC(doc, [165, 180, 252])
    doc.text(sanitize(line), 18, vly)
    vly += 7
  }

  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, LIGHT)
  doc.text('Fecha de emision:', 112, y + 8)
  setFont(doc, 'bold'); setTC(doc, WHITE)
  doc.text(generatedAt, 112, y + 15)
  setFont(doc, 'normal'); setTC(doc, AMBER)
  doc.text(`Valida hasta: ${validUntil}`, 112, y + 22)
  y += vendorBoxH + 8

  roundRect(doc, 14, y, 182, 12, 2, [45, 35, 10])
  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, AMBER)
  doc.text('Esta propuesta tiene una validez de 15 dias corridos desde la fecha de emision.', 18, y + 8)

  // Resumen rapido en la parte inferior de la portada
  y += 16
  roundRect(doc, 14, y, 182, 32, 3, SURFACE)
  setFont(doc, 'bold'); doc.setFontSize(10); setTC(doc, LIGHT)
  doc.text('Resumen de inversion', 18, y + 9)

  setFont(doc, 'bold'); doc.setFontSize(16); setTC(doc, WHITE)
  const totalDisplay = formatCurrency(Number(formData.budget ?? 0))
  doc.text(totalDisplay, 18, y + 20)
  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, LIGHT)
  doc.text('Presupuesto total', 18, y + 26)

  const fmtLabels = sanitize(
    (formData.formats ?? []).map(f => FORMAT_MAP[f]?.label ?? f).join(' - ')
  )
  if (fmtLabels) {
    setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, [165, 180, 252])
    doc.text(truncate(doc, fmtLabels, 100), 100, y + 20)
  }

  const dateRange = `${formData.startDate ?? '-'} al ${formData.endDate ?? '-'}`
  setFont(doc, 'normal'); doc.setFontSize(8); setTC(doc, LIGHT)
  doc.text(dateRange, 100, y + 26)
}

async function renderOption(doc, {
  option, label, formData, orgName, mapBase64,
  occupiedIds = new Set(), mockupMap = {}, siteCarasMap = {},
}) {
  if (!option) return

  addPageBackground(doc)
  miniHeader(doc, orgName)

  let y = 18

  roundRect(doc, 14, y, 182, 12, 2, BRAND)
  setFont(doc, 'bold'); doc.setFontSize(12); setTC(doc, WHITE)
  doc.text(sanitize(`${label === 'A' ? 'A -' : 'B -'} ${option.title ?? `Opcion ${label}`}`), 18, y + 8.5)
  y += 18

  if (option.rationale) {
    roundRect(doc, 14, y, 182, 16, 2, [20, 30, 55])
    setFont(doc, 'italic'); doc.setFontSize(8); setTC(doc, [165, 180, 252])
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
    roundRect(doc, 14, rowY, 182, kpiH, 2, SURFACE)
    setFont(doc, 'bold'); doc.setFontSize(7); setTC(doc, LIGHT)
    doc.text(row[0], 18, rowY + 7)
    setFont(doc, 'normal'); setTC(doc, WHITE)
    doc.text(row[1], 60, rowY + 7)
    doc.text(row[2], 110, rowY + 7)
    setTC(doc, LIGHT)
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
      doc.text(`Con ${formatCurrency(gap)} mas podes agregar el siguiente cartel disponible.`, 18, y + 7)
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

  setFont(doc, 'bold'); doc.setFontSize(9); setTC(doc, LIGHT)
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
      // ── MOCKUP LAYOUT: imagen proporcional arriba, texto abajo ──

      // Cargar imagen para obtener aspecto real
      let imgData = photoUrl
      if (!photoUrl.startsWith('data:')) {
        imgData = await fetchLogoBase64(photoUrl)
      }

      // Calcular dimensiones proporcionales
      const MAX_W = 140  // mm - ancho maximo (centrado en card de 182mm)
      const MAX_H = 55   // mm - alto maximo
      let imgW = MAX_W
      let imgH = MAX_H

      if (imgData) {
        const dims = await getImageDims(imgData)
        if (dims && dims.w > 0 && dims.h > 0) {
          const ratio = dims.w / dims.h
          if (ratio >= MAX_W / MAX_H) {
            // Imagen mas ancha que el box -> limitar por ancho
            imgW = MAX_W
            imgH = MAX_W / ratio
          } else {
            // Imagen mas alta que el box -> limitar por alto
            imgH = MAX_H
            imgW = MAX_H * ratio
          }
        }
      }

      const TEXT_H = hasJ ? 24 : 18
      const rowH = imgH + TEXT_H + 6
      const imgX = 14 + (182 - imgW) / 2  // Centrar horizontalmente

      if (y + rowH > 278) {
        doc.addPage()
        addPageBackground(doc)
        miniHeader(doc, orgName)
        y = 18
      }

      roundRect(doc, 14, y, 182, rowH, 2, SURFACE)

      // Imagen mockup centrada
      if (imgData) {
        try {
          doc.addImage(imgData, 'JPEG', imgX, y + 2, imgW, imgH)
        } catch { /* ignorar */ }
      }

      // Badge MOCKUP
      const badgeY = y + imgH - 3
      roundRect(doc, imgX, badgeY, 18, 6, 1, BRAND)
      setFont(doc, 'bold')
      doc.setFontSize(5)
      setTC(doc, WHITE)
      doc.text('MOCKUP', imgX + 1.5, badgeY + 4)

      // Texto debajo de la imagen
      const textY = y + imgH + 5

      // Linea 1: nombre + formato + precio
      setFont(doc, 'bold'); doc.setFontSize(8.5); setTC(doc, WHITE)
      doc.text(truncate(doc, sanitize(site.name ?? '-'), 110), 18, textY)

      const fmt = FORMAT_MAP[site.format]
      if (fmt) {
        setFont(doc, 'normal'); doc.setFontSize(7); setTC(doc, LIGHT)
        doc.text(fmt.label, 160, textY)
      }

      const precioCliente = site.client_price ?? site.list_price ?? 0
      setFont(doc, 'bold'); doc.setFontSize(8); setTC(doc, GREEN)
      doc.text(formatCurrency(precioCliente), 192, textY, { align: 'right' })

      // Linea 2: direccion
      setFont(doc, 'normal'); doc.setFontSize(7.5); setTC(doc, LIGHT)
      doc.text(truncate(doc, sanitize(site.address ?? ''), 140), 18, textY + 6)

      // Badge obligatorio
      if (site.is_mandatory) {
        roundRect(doc, 150, textY + 1, 26, 6, 1, [80, 50, 10])
        setFont(doc, 'bold'); doc.setFontSize(6); setTC(doc, AMBER)
        doc.text('OBLIGATORIO', 151, textY + 5)
      }

      // Linea 3: justificacion
      if (hasJ) {
        setFont(doc, 'italic'); doc.setFontSize(7); setTC(doc, [100, 116, 139])
        doc.text(sanitize(`"${truncate(doc, site.justification, 170)}"`), 18, textY + 13)
      }

      y += rowH + 2

    } else {
      // ── LAYOUT NORMAL: foto izquierda o sin foto ──
      const PHOTO_W = hasPhoto ? 32 : 0
      const PHOTO_H = 22
      const rowH = hasPhoto
        ? Math.max(PHOTO_H + 4, hasJ ? 32 : 26)
        : (hasJ ? 26 : 19)

      if (y + rowH > 278) {
        doc.addPage()
        addPageBackground(doc)
        miniHeader(doc, orgName)
        y = 18
      }

      roundRect(doc, 14, y, 182, rowH, 2, SURFACE)

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

      setFont(doc, 'bold'); doc.setFontSize(8.5); setTC(doc, WHITE)
      doc.text(truncate(doc, sanitize(site.name ?? '-'), textMaxW), textX, y + 7)

      if (site.is_mandatory) {
        roundRect(doc, 148, y + 2, 26, 6, 1, [80, 50, 10])
        setFont(doc, 'bold'); doc.setFontSize(6); setTC(doc, AMBER)
        doc.text('OBLIGATORIO', 149, y + 6.5)
      }

      const fmt = FORMAT_MAP[site.format]
      if (fmt) {
        setFont(doc, 'normal'); doc.setFontSize(7); setTC(doc, LIGHT)
        doc.text(fmt.label, 192, y + 7, { align: 'right' })
      }

      setFont(doc, 'normal'); doc.setFontSize(7.5); setTC(doc, LIGHT)
      doc.text(truncate(doc, sanitize(site.address ?? ''), hasPhoto ? 95 : 120), textX, y + 14)

      const precioCliente = site.client_price ?? site.list_price ?? 0
      setFont(doc, 'bold'); doc.setFontSize(7.5); setTC(doc, GREEN)
      doc.text(formatCurrency(precioCliente), 192, y + 14, { align: 'right' })

      if (hasJ) {
        setFont(doc, 'italic'); doc.setFontSize(7); setTC(doc, [100, 116, 139])
        doc.text(sanitize(`"${truncate(doc, site.justification, hasPhoto ? 140 : 170)}"`), textX, y + 21)
      }

      y += rowH + 1.5
    }
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
      `(!) ${occupiedCount} cartel${occupiedCount > 1 ? 'es' : ''} adicional${occupiedCount > 1 ? 'es' : ''} excluido${occupiedCount > 1 ? 's' : ''} por estar ocupado${occupiedCount > 1 ? 's' : ''} en las fechas solicitadas.`,
      18, y + 8
    )
    y += 16
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
}) {
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
