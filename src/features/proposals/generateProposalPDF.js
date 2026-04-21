/**
 * generateProposalPDF — v3
 * Arquitectura limpia, sin duplicados.
 */

import { formatCurrency } from '../../lib/utils'
import { FORMAT_MAP } from '../../lib/constants'

// ── Paleta ───────────────────────────────────────────────────
const C = {
  bg:      [15,  23,  42],
  surface: [30,  41,  59],
  surface2:[40,  50,  70],
  accent:  [99,  102, 241],
  green:   [34,  197, 94],
  amber:   [245, 158, 11],
  orange:  [249, 115, 22],
  white:   [248, 250, 252],
  light:   [148, 163, 184],
  muted:   [71,  85,  105],
  warnBg:  [45,  35,  10],
  infoBg:  [20,  35,  55],
  infoTxt: [147, 197, 253],
  strike:  [120, 130, 150],
  justTxt: [90,  105, 130],
  mandBg:  [80,  50,  10],
}

// ── Helpers de valor ─────────────────────────────────────────
async function toB64(url) {
  try {
    if (!url) return null
    const r = await fetch(url)
    if (!r.ok) return null
    const blob = await r.blob()
    return new Promise(resolve => {
      const rd = new FileReader()
      rd.onload  = () => resolve(rd.result)
      rd.onerror = () => resolve(null)
      rd.readAsDataURL(blob)
    })
  } catch { return null }
}

function peso(n) { return formatCurrency(Number(n ?? 0)) }

function impStr(n) {
  const v = Math.round(Number(n ?? 0))
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
  return v.toLocaleString('es-AR')
}

function san(t) {
  if (!t) return ''
  return String(t)
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2190-\u2199]/g, '->')
    .replace(/\u26A0/g, '(!)')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[^\x00-\xFF]/g, '')
}

function clip(doc, text, maxW) {
  if (!text) return ''
  const s = san(String(text))
  if (doc.getTextWidth(s) <= maxW) return s
  let t = s
  while (doc.getTextWidth(t + '...') > maxW && t.length > 0) t = t.slice(0, -1)
  return t + '...'
}

// ── Draw helpers ─────────────────────────────────────────────
function fr(doc, x, y, w, h, color) {
  doc.setFillColor(...color); doc.rect(x, y, w, h, 'F')
}
function frr(doc, x, y, w, h, r, color) {
  doc.setFillColor(...color); doc.roundedRect(x, y, w, h, r, r, 'F')
}
function hl(doc, y, color, x1 = 14, x2 = 196) {
  doc.setDrawColor(...color); doc.setLineWidth(0.2); doc.line(x1, y, x2, y)
}
function tc(doc, color)                { doc.setTextColor(...color) }
function fnt(doc, style = 'normal', size = null) {
  doc.setFont('helvetica', style)
  if (size) doc.setFontSize(size)
}
function addImg(doc, data, x, y, w, h) {
  if (!data) return
  try {
    doc.addImage(data, data.startsWith('data:image/png') ? 'PNG' : 'JPEG', x, y, w, h)
  } catch { /* ignorar */ }
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

// ── Estructura de página ──────────────────────────────────────
function pageBg(doc) { fr(doc, 0, 0, 210, 297, C.bg) }

function pageHeader(doc, orgName, pageLabel) {
  fr(doc, 0, 0, 210, 10, C.accent)
  fnt(doc, 'bold', 7); tc(doc, C.white)
  doc.text(san(orgName), 14, 7)
  if (pageLabel) {
    fnt(doc, 'normal', 6.5); tc(doc, [199, 210, 254])
    doc.text(san(pageLabel), 196, 7, { align: 'right' })
  }
  return 14
}

function pageFooter(doc, vendorName, orgName, pageNum, totalPages) {
  fnt(doc, 'normal', 7); tc(doc, C.muted)
  doc.text(san(`${vendorName} · ${orgName}`), 14, 289)
  doc.text(`${pageNum} / ${totalPages}`, 196, 289, { align: 'right' })
}

// ── Portada ───────────────────────────────────────────────────
function renderCover(doc, { formData, profile, org, logoB64, generatedAt, validUntil, summaryData }) {
  pageBg(doc)
  const orgName    = san(org?.name ?? 'OOH Planner')
  const vendorName = san(profile?.full_name ?? 'Vendedor')

  // Header band
  fr(doc, 0, 0, 210, 42, C.accent)
  if (logoB64) { try { doc.addImage(logoB64, 'PNG', 14, 7, 26, 26) } catch {} }
  const tx = logoB64 ? 46 : 14
  fnt(doc, 'bold', 16);    tc(doc, C.white);           doc.text(orgName, tx, 19)
  fnt(doc, 'normal', 9);   tc(doc, [199, 210, 254]);   doc.text('Propuesta Publicitaria OOH', tx, 27)

  // Título
  let y = 56
  fnt(doc, 'bold', 20);    tc(doc, C.white);           doc.text('Propuesta OOH', 14, y);  y += 10
  fnt(doc, 'normal', 13);  tc(doc, [165, 180, 252]);   doc.text(san(formData.clientName ?? '-'), 14, y);  y += 12
  hl(doc, y, C.surface2);  y += 6

  // Grilla de datos
  const fmtList = (formData.formats ?? []).map(f => FORMAT_MAP[f]?.label ?? f)
  const leftRows = [
    ['Cliente',    san(formData.clientName ?? '-')],
    ['Email',      san(formData.clientEmail || '-')],
    ['Objetivo',   san(formData.objective ?? '-')],
    ['Ciudades',   san((formData.cities ?? []).join(', ') || '-')],
    ['Provincias', san((formData.provinces ?? []).join(', ') || '-')],
  ]
  const rightRows = [
    ['Inicio',      san(formData.startDate ?? '-')],
    ['Fin',         san(formData.endDate ?? '-')],
    ['Presupuesto', peso(formData.budget)],
    ['Descuento',   formData.discountPct > 0 ? `${formData.discountPct}%` : 'Sin descuento'],
    ['Formatos',    ''],
  ]

  doc.setFontSize(8.5)
  leftRows.forEach(([lbl, val], i) => {
    const ry = y + i * 7.5
    fnt(doc, 'normal'); tc(doc, C.light);  doc.text(lbl + ':', 14, ry)
    fnt(doc, 'bold');   tc(doc, C.white);  doc.text(clip(doc, val, 72), 50, ry)
  })
  rightRows.forEach(([lbl, val], i) => {
    const ry = y + i * 7.5
    fnt(doc, 'normal'); tc(doc, C.light);  doc.text(lbl + ':', 112, ry)
    fnt(doc, 'bold');   tc(doc, C.white);  doc.text(clip(doc, val, 62), 146, ry)
  })

  // Formatos inline (fila 5)
  if (fmtList.length > 0) {
    const fmtY = y + 4 * 7.5
    fnt(doc, 'bold', 7); tc(doc, C.white)
    const lines = doc.splitTextToSize(san(fmtList.join(' · ')), 48)
    doc.text(lines.slice(0, 2), 146, fmtY)
    if (lines.length > 2) doc.text('...', 146, fmtY + 8)
  }

  y += Math.max(leftRows.length, rightRows.length) * 7.5 + 5
  hl(doc, y, C.surface2);  y += 5

  // Caja del vendedor
  const contactLines = [
    profile?.phone        ? `Tel: ${profile.phone}` : null,
    profile?.email        ? profile.email            : null,
    profile?.office_hours ? profile.office_hours     : null,
  ].filter(Boolean)
  const boxH = Math.max(28, 24 + contactLines.length * 6)

  frr(doc, 14, y, 182, boxH, 2, C.surface)
  fnt(doc, 'bold', 8.5);   tc(doc, C.light);             doc.text('Preparado por:', 18, y + 7)
  tc(doc, C.white);                                       doc.text(vendorName, 18, y + 14)
  fnt(doc, 'normal', 7.5); tc(doc, C.light);             doc.text(orgName, 18, y + 20)
  let vly = y + 26
  for (const line of contactLines) {
    tc(doc, [165, 180, 252]); doc.text(san(line), 18, vly); vly += 6
  }
  fnt(doc, 'normal', 7.5); tc(doc, C.light);   doc.text('Fecha de emision:', 112, y + 7)
  fnt(doc, 'bold');         tc(doc, C.white);  doc.text(generatedAt, 112, y + 14)
  fnt(doc, 'normal');       tc(doc, C.amber);  doc.text(`Valida hasta: ${validUntil}`, 112, y + 20)
  y += boxH + 6

  // Strip de validez
  frr(doc, 14, y, 182, 10, 2, C.warnBg)
  fnt(doc, 'normal', 7.5); tc(doc, C.amber)
  doc.text('Propuesta valida por 15 dias corridos desde la fecha de emision.', 18, y + 6.5)
  y += 14

  // Resumen de inversión
  frr(doc, 14, y, 182, 28, 2, C.surface)
  fnt(doc, 'bold', 10);    tc(doc, C.light);  doc.text('Resumen de inversion', 18, y + 8)
  fnt(doc, 'bold', 15);    tc(doc, C.white);  doc.text(peso(formData.budget), 18, y + 19)
  fnt(doc, 'normal', 7.5); tc(doc, C.light);  doc.text('Presupuesto total', 18, y + 24)
  if (fmtList.length > 0) {
    fnt(doc, 'normal', 7.5); tc(doc, [165, 180, 252])
    doc.text(clip(doc, san(fmtList.join(' · ')), 88), 100, y + 19)
  }
  fnt(doc, 'normal', 7.5); tc(doc, C.light)
  doc.text(san(`${formData.startDate ?? '-'} al ${formData.endDate ?? '-'}`), 100, y + 24)
  y += 28

  // KPIs de la opción (si caben)
  if (summaryData && y + 54 < 282) {
    y += 6
    fnt(doc, 'bold', 8.5); tc(doc, C.light)
    doc.text(san(`Opcion: ${summaryData.optionTitle}`), 14, y)
    y += 6

    const mW = 88, mH = 20
    const kpis = [
      { label: 'Impactos / Contactos', value: impStr(summaryData.totalImpacts), sub: `${summaryData.digitalCount} digital + ${summaryData.physicalCount} fisico` },
      { label: 'Inversion cliente',    value: peso(summaryData.totalClient),     sub: 'Con descuento aplicado' },
      { label: 'Soportes',             value: String(summaryData.totalSites),    sub: 'Carteles en la pauta' },
      { label: 'CPM (costo por mil)',   value: summaryData.cpm > 0 ? `$ ${impStr(summaryData.cpm)}` : '-', sub: 'Eficiencia de la inversion' },
    ]
    for (let i = 0; i < kpis.length; i++) {
      const col = i % 2, row = Math.floor(i / 2)
      const mx = 14 + col * (mW + 6)
      const my = y + row * (mH + 3)
      if (my + mH > 282) break
      frr(doc, mx, my, mW, mH, 2, C.surface)
      fnt(doc, 'normal', 6.5); tc(doc, C.light);  doc.text(kpis[i].label, mx + 3, my + 6)
      fnt(doc, 'bold', 12);    tc(doc, C.white);  doc.text(kpis[i].value,  mx + 3, my + 14)
      fnt(doc, 'normal', 6);   tc(doc, C.muted);  doc.text(kpis[i].sub,    mx + 3, my + 18)
    }
  }
}

// ── Card individual (para grid 2 columnas) ────────────────────
const CARD_H = 82
const CARD_W = (182 - 5) / 2  // ~88.5 mm

function drawCard(doc, site, cx, cy, w, { mockupDataUrl, photoUrl, siteData } = {}) {
  const hasImg  = !!(mockupDataUrl ?? photoUrl)
  const hasMock = !!mockupDataUrl
  const hasJ    = !!site.justification
  const DIGITAL_FMT = new Set(['digital', 'urban_furniture_digital'])

  frr(doc, cx, cy, w, CARD_H, 2, C.surface)

  // Imagen top (si hay)
  const IMG_H = 38
  if (hasImg) {
    const imgData = mockupDataUrl ?? photoUrl
    try {
      doc.addImage(imgData, imgData?.startsWith('data:image/png') ? 'PNG' : 'JPEG', cx, cy, w, IMG_H, undefined, 'FAST')
    } catch {}
    if (hasMock) {
      frr(doc, cx + 2, cy + IMG_H - 7, 20, 6, 1, C.accent)
      fnt(doc, 'bold', 4.5); tc(doc, C.white)
      doc.text('MOCKUP', cx + 3.5, cy + IMG_H - 3)
    }
  }

  const textY = hasImg ? cy + IMG_H + 4 : cy + 5

  // Nombre
  fnt(doc, 'bold', 8); tc(doc, C.white)
  doc.text(clip(doc, san(site.name ?? '-'), w - 6), cx + 3, textY)

  // Formato
  const fmt = FORMAT_MAP[site.format]
  if (fmt) {
    fnt(doc, 'normal', 6); tc(doc, C.light)
    doc.text(fmt.label, cx + w - 3, textY, { align: 'right' })
  }

  // Obligatorio
  if (site.is_mandatory) {
    frr(doc, cx + 3, textY + 2, 22, 5, 1, C.mandBg)
    fnt(doc, 'bold', 4.5); tc(doc, C.amber)
    doc.text('OBLIGATORIO', cx + 4, textY + 5.5)
  }

  // Dirección
  fnt(doc, 'normal', 6.5); tc(doc, C.light)
  doc.text(clip(doc, san(site.address ?? ''), w - 6), cx + 3, textY + 8)

  // Precio
  const clientPrice = site.client_price ?? site.list_price ?? 0
  fnt(doc, 'bold', 8.5); tc(doc, C.green)
  doc.text(peso(clientPrice), cx + w - 3, textY + 8, { align: 'right' })

  // Impactos
  const impacts = site.monthly_impacts ?? 0
  if (impacts > 0) {
    const isD = DIGITAL_FMT.has(site.format)
    fnt(doc, 'normal', 6); tc(doc, C.muted)
    doc.text(`${isD ? 'Imp' : 'Cont'}: ${impStr(impacts)}/mes`, cx + 3, textY + 14)
  }

  // Specs
  const specParts = []
  if (siteData?.width && siteData?.height) specParts.push(`${siteData.width} x ${siteData.height} m`)
  if (siteData?.illuminated) specParts.push('Ilum.')
  if (specParts.length > 0) {
    fnt(doc, 'normal', 5.5); tc(doc, C.infoTxt)
    doc.text(specParts.join(' · '), cx + 3, textY + 19)
  }

  // Justificación
  if (hasJ) {
    fnt(doc, 'italic', 6); tc(doc, C.justTxt)
    const jLines = doc.splitTextToSize(san(`"${site.justification}"`), w - 6)
    doc.text(jLines.slice(0, 2), cx + 3, textY + (specParts.length > 0 ? 24 : 19))
  }
}

// ── Grid de carteles (2 columnas) ─────────────────────────────
async function renderGrid(doc, { sites, orgName, label, mockupMap, siteCarasMap, occupiedIds }, startY) {
  let y = startY
  const cols = 2

  for (let i = 0; i < sites.length; i += cols) {
    if (y + CARD_H > 278) {
      doc.addPage(); pageBg(doc); pageHeader(doc, orgName, `Propuesta ${label}`); y = 18
    }
    for (let col = 0; col < cols; col++) {
      const site = sites[i + col]
      if (!site) break
      const cx = 14 + col * (CARD_W + 5)
      const mockupDataUrl = mockupMap[site.id] ?? null
      const siteData      = siteCarasMap[site.id] ?? null
      let photoUrl = siteData?.photoUrl ?? site.photo_url ?? null
      if (photoUrl && !photoUrl.startsWith('data:')) {
        photoUrl = await toB64(photoUrl)
      }
      drawCard(doc, site, cx, y, CARD_W, { mockupDataUrl, photoUrl, siteData })
    }
    y += CARD_H + 4
  }
  return y
}

// ── Estrategia / Opción ────────────────────────────────────────
async function renderStrategy(doc, {
  option, label, formData, orgName,
  occupiedIds = new Set(), mockupMap = {}, siteCarasMap = {},
}) {
  if (!option) return

  pageBg(doc)
  pageHeader(doc, orgName, `Propuesta ${label}`)

  const DIGITAL_FMT = new Set(['digital', 'urban_furniture_digital'])
  let y = 18

  // Título de la opción
  frr(doc, 14, y, 182, 12, 2, C.accent)
  fnt(doc, 'bold', 12); tc(doc, C.white)
  doc.text(san(`${label} - ${option.title ?? `Opcion ${label}`}`), 18, y + 8.5)
  y += 16

  // Rationale
  if (option.rationale) {
    frr(doc, 14, y, 182, 15, 2, C.infoBg)
    fnt(doc, 'italic', 8); tc(doc, C.infoTxt)
    const lines = doc.splitTextToSize(san(option.rationale), 174)
    doc.text(lines.slice(0, 2), 18, y + 6)
    y += 19
  }

  // KPI rows DOOH / OFF / Total
  const availSites   = (option.sites ?? []).filter(s => !occupiedIds.has(s.id))
  const digitalSites  = availSites.filter(s =>  DIGITAL_FMT.has(s.format))
  const physicalSites = availSites.filter(s => !DIGITAL_FMT.has(s.format))

  const doohImpacts   = digitalSites.reduce((s, x)  => s + (x.monthly_impacts ?? 0), 0)
  const doohInversion = digitalSites.reduce((s, x)  => s + (x.client_price ?? 0), 0)
  const offContactos  = physicalSites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0)
  const offInversion  = physicalSites.reduce((s, x) => s + (x.client_price ?? 0), 0)
  const totalInversion = doohInversion + offInversion

  // KPI rows DOOH / OFF / Total — calculado después de availSites
  const kpiListTotal = availSites.reduce((s, x) => s + (x.list_price ?? 0), 0)
  const kpiRows = []
  if (digitalSites.length > 0)  kpiRows.push(['DOOH',  `Impactos: ${impStr(doohImpacts)}`,  `Inversion: ${peso(doohInversion)}`,  `${digitalSites.length} pantalla${digitalSites.length > 1 ? 's' : ''}`])
  if (physicalSites.length > 0) kpiRows.push(['OFF',   `Contactos: ${impStr(offContactos)}`, `Inversion: ${peso(offInversion)}`,   `${physicalSites.length} soporte${physicalSites.length > 1 ? 's' : ''}`])
  kpiRows.push(['Total', peso(doohInversion + offInversion), `Lista: ${peso(kpiListTotal)}`, ''])

  const kH = 10
  kpiRows.forEach((row, ri) => {
    const ry = y + ri * (kH + 2)
    frr(doc, 14, ry, 182, kH, 2, C.surface)
    fnt(doc, 'bold', 7);   tc(doc, C.light);  doc.text(row[0], 18, ry + 7)
    fnt(doc, 'normal');    tc(doc, C.white);  doc.text(row[1], 58, ry + 7)
    doc.text(row[2], 108, ry + 7)
    tc(doc, C.light);                         doc.text(row[3], 192, ry + 7, { align: 'right' })
  })
  y += kpiRows.length * (kH + 2) + 3

  // Desglose financiero — calculado desde availSites (excluye ocupados)
  const discount    = formData.discountPct ?? 0
  const listTotal   = availSites.reduce((s, x) => s + (x.list_price   ?? 0), 0)
  const clientTotal = availSites.reduce((s, x) => s + (x.client_price ?? 0), 0)
  const discountAmt = listTotal - clientTotal
  const remaining   = Math.max(0, Number(formData.budget ?? 0) - clientTotal)
  const gap         = option.next_billboard_gap ?? 0

  if (listTotal > 0) {
    frr(doc, 14, y, 182, discount > 0 ? 28 : 18, 2, C.surface)
    fnt(doc, 'normal', 8); tc(doc, C.light)
    doc.text('Precio de lista:', 18, y + 7)
    fnt(doc, 'bold'); tc(doc, C.white)
    doc.text(peso(listTotal), 192, y + 7, { align: 'right' })

    if (discount > 0) {
      tc(doc, C.green); fnt(doc, 'bold')
      doc.text(`Descuento ${discount}%:`, 18, y + 15)
      doc.text(`-${peso(discountAmt)}`, 192, y + 15, { align: 'right' })
      tc(doc, C.white); doc.setFontSize(10)
      doc.text('Total cliente:', 18, y + 24)
      doc.text(peso(clientTotal), 192, y + 24, { align: 'right' })
      y += 34
    } else {
      fnt(doc, 'bold'); tc(doc, C.white); doc.setFontSize(10)
      doc.text('Total cliente:', 18, y + 15)
      doc.text(peso(clientTotal), 192, y + 15, { align: 'right' })
      y += 24
    }

    if (remaining > 0) {
      fnt(doc, 'normal', 8); tc(doc, C.light)
      doc.text(`Presupuesto restante: ${peso(remaining)}`, 18, y);  y += 6
    }
    if (gap > 0) {
      frr(doc, 14, y, 182, 10, 2, C.infoBg)
      fnt(doc, 'normal', 7.5); tc(doc, C.infoTxt)
      doc.text(`Con ${peso(gap)} mas podes agregar el siguiente cartel disponible.`, 18, y + 7)
      y += 14
    }
    y += 4
  }

  // Encabezado de carteles
  const firstHasMockup = !!mockupMap[availSites[0]?.id]
  if (y + (firstHasMockup ? 85 : 30) > 278) {
    doc.addPage(); pageBg(doc); pageHeader(doc, orgName, `Propuesta ${label}`); y = 18
  }
  fnt(doc, 'bold', 9); tc(doc, C.light)
  doc.text(san(`Carteles seleccionados (${availSites.length})`), 14, y)
  y += 6

  // Decidir layout: mockup (columna simple) o grid 2 columnas
  const hasMockups = availSites.some(s => !!mockupMap[s.id])

  if (hasMockups) {
    // Layout de columna simple con imagen izquierda grande
    for (const site of availSites) {
      const mockupDataUrl = mockupMap[site.id] ?? null
      const siteData      = siteCarasMap[site.id] ?? null
      const photoUrl      = mockupDataUrl ?? siteData?.photoUrl ?? site.photo_url ?? null
      const hasMockup     = !!mockupDataUrl
      const hasJ          = !!site.justification

      if (hasMockup) {
        let imgData = photoUrl
        if (imgData && !imgData.startsWith('data:')) imgData = await toB64(imgData)

        const IM_W = 65, IM_H = 48
        let imgW = IM_W, imgH = IM_H
        if (imgData) {
          const dims = await new Promise(res => {
            const img = new Image()
            img.onload  = () => res({ w: img.naturalWidth, h: img.naturalHeight })
            img.onerror = () => res(null)
            img.src = imgData
          })
          if (dims?.w > 0 && dims?.h > 0) {
            const rat = dims.w / dims.h
            if (rat >= IM_W / IM_H) { imgW = IM_W; imgH = IM_W / rat }
            else                    { imgH = IM_H; imgW = IM_H * rat }
          }
        }

        const rowH = Math.max(imgH + 4, hasJ ? 42 : 35)
        if (y + rowH > 278) {
          doc.addPage(); pageBg(doc); pageHeader(doc, orgName, `Propuesta ${label}`); y = 18
        }

        frr(doc, 14, y, 182, rowH, 2, C.surface)
        const imgY = y + (rowH - imgH) / 2
        addImg(doc, imgData, 16, imgY, imgW, imgH)

        // Badge MOCKUP
        frr(doc, 16, imgY + imgH - 5, 18, 5, 1, C.accent)
        fnt(doc, 'bold', 4.5); tc(doc, C.white)
        doc.text('MOCKUP', 17.5, imgY + imgH - 1.5)

        // Info derecha — tX fijo para no depender de imgW variable
        const tX = 16 + IM_W + 4
        const rW = 192 - tX
        let tY = y + 5

        fnt(doc, 'bold', 9); tc(doc, C.white)
        doc.text(clip(doc, san(site.name ?? '-'), rW - 40), tX, tY)

        const fmt = FORMAT_MAP[site.format]
        if (fmt) { fnt(doc, 'normal', 7); tc(doc, C.light); doc.text(fmt.label, 192, tY, { align: 'right' }) }
        if (site.is_mandatory) {
          const mX = 192 - 26 - (fmt ? 35 : 0)
          frr(doc, mX, tY - 3, 24, 5, 1, C.mandBg)
          fnt(doc, 'bold', 5); tc(doc, C.amber); doc.text('OBLIGATORIO', mX + 1, tY + 0.5)
        }
        if (site.justification === 'Agregado manualmente') {
          // Badge "+ AGREGADO" — diferenciado del "OBLIGATORIO" para indicar que es un cartel
          // sumado posteriormente al brief original (típicamente fuera del presupuesto inicial)
          const aX = 192 - 22 - (fmt ? 35 : 0) - (site.is_mandatory ? 26 : 0)
          frr(doc, aX, tY - 3, 20, 5, 1, C.mandBg)
          fnt(doc, 'bold', 5); tc(doc, C.amber); doc.text('+ AGREGADO', aX + 1, tY + 0.5)
        }
        tY += 5.5

        fnt(doc, 'normal', 7.5); tc(doc, C.light)
        doc.text(clip(doc, san(site.address ?? ''), rW - 5), tX, tY)
        tY += 6

        // Specs
        const specParts = []
        if (siteData?.width && siteData?.height) specParts.push(`${siteData.width} x ${siteData.height} m`)
        if (siteData?.illuminated) specParts.push('Iluminado')
        if (specParts.length > 0) {
          fnt(doc, 'normal', 6.5); tc(doc, C.infoTxt)
          doc.text(specParts.join(' | '), tX, tY);  tY += 4
        }

        // Separador
        doc.setDrawColor(...[40, 50, 70]); doc.setLineWidth(0.15)
        doc.line(tX, tY, tX + rW - 5, tY);  tY += 4

        // Impactos
        const isD = new Set(['digital', 'urban_furniture_digital']).has(site.format)
        const imp = site.monthly_impacts ?? 0
        if (imp > 0) {
          fnt(doc, 'normal', 7); tc(doc, C.light)
          doc.text(isD ? 'Impactos/mes:' : 'Contactos/mes:', tX, tY)
          fnt(doc, 'bold'); tc(doc, C.white)
          doc.text(Math.round(imp).toLocaleString('es-AR'), tX + 28, tY)
          tY += 5
        }

        // Precio
        const lp = site.list_price ?? 0
        if (lp > 0) {
          fnt(doc, 'normal', 7); tc(doc, C.light);  doc.text('Lista:', tX, tY)
          fnt(doc, 'normal');    tc(doc, C.strike); doc.text(peso(lp), tX + 28, tY)
          fnt(doc, 'bold', 9);   tc(doc, C.green);  doc.text(peso(site.client_price ?? lp), 192, tY, { align: 'right' })
          tY += 6
        } else {
          fnt(doc, 'bold', 9); tc(doc, C.green)
          doc.text(peso(site.client_price ?? 0), 192, tY, { align: 'right' });  tY += 6
        }

        if (hasJ) {
          fnt(doc, 'italic', 6.5); tc(doc, C.justTxt)
          const jl = doc.splitTextToSize(san(`"${site.justification}"`), rW - 5)
          doc.text(jl.slice(0, 2), tX, tY)
        }
        y += rowH + 2

      } else {
        // Tarjeta normal (sin mockup)
        const hasPhoto = !!photoUrl
        const PW = hasPhoto ? 32 : 0, PH = 22
        const hasImpacts = (site.monthly_impacts ?? 0) > 0
        const rowH = hasPhoto
          ? Math.max(PH + 4, hasJ ? 35 : (hasImpacts ? 28 : 26))
          : (hasJ ? 28 : (hasImpacts ? 22 : 19))

        if (y + rowH > 278) {
          doc.addPage(); pageBg(doc); pageHeader(doc, orgName, `Propuesta ${label}`); y = 18
        }

        frr(doc, 14, y, 182, rowH, 2, C.surface)
        if (hasPhoto) {
          let imgData = photoUrl
          if (!imgData.startsWith('data:')) imgData = await toB64(imgData)
          addImg(doc, imgData, 16, y + 2, PW, PH)
        }

        const tX = 18 + PW
        fnt(doc, 'bold', 8.5); tc(doc, C.white)
        doc.text(clip(doc, san(site.name ?? '-'), hasPhoto ? 95 : (site.is_mandatory ? 110 : 130)), tX, y + 7)
        if (site.is_mandatory) {
          frr(doc, 148, y + 2, 26, 6, 1, C.mandBg)
          fnt(doc, 'bold', 6); tc(doc, C.amber); doc.text('OBLIGATORIO', 149, y + 6.5)
        }
        if (site.justification === 'Agregado manualmente') {
          // Posición: corrida hacia la izquierda si hay OBLIGATORIO, sino misma posición que él
          const aXBase = site.is_mandatory ? 120 : 148
          frr(doc, aXBase, y + 2, 26, 6, 1, C.mandBg)
          fnt(doc, 'bold', 6); tc(doc, C.amber); doc.text('+ AGREGADO', aXBase + 1, y + 6.5)
        }
        const fmt = FORMAT_MAP[site.format]
        if (fmt) { fnt(doc, 'normal', 7); tc(doc, C.light); doc.text(fmt.label, 192, y + 7, { align: 'right' }) }
        fnt(doc, 'normal', 7.5); tc(doc, C.light)
        doc.text(clip(doc, san(site.address ?? ''), hasPhoto ? 95 : 120), tX, y + 14)
        fnt(doc, 'bold', 7.5); tc(doc, C.green)
        doc.text(peso(site.client_price ?? site.list_price ?? 0), 192, y + 14, { align: 'right' })
        const imp2 = site.monthly_impacts ?? 0
        if (imp2 > 0) {
          const isD2 = new Set(['digital', 'urban_furniture_digital']).has(site.format)
          fnt(doc, 'normal', 6.5); tc(doc, C.light)
          doc.text(`${isD2 ? 'Impactos' : 'Contactos'}: ${Math.round(imp2).toLocaleString('es-AR')}`, tX, y + (hasPhoto ? 19 : 12))
        }
        if (hasJ) {
          fnt(doc, 'italic', 7); tc(doc, C.justTxt)
          doc.text(san(`"${clip(doc, site.justification, hasPhoto ? 140 : 170)}"`), tX, y + 21)
        }
        y += rowH + 1.5
      }
    }
  } else {
    // Sin mockups → grid 2 columnas
    y = await renderGrid(doc, { sites: availSites, orgName, label, mockupMap, siteCarasMap, occupiedIds }, y)
  }

  // Warning de ocupados
  const occupiedCount = (option.sites ?? []).length - availSites.length
  if (occupiedCount > 0) {
    if (y + 14 > 285) {
      doc.addPage(); pageBg(doc); pageHeader(doc, orgName, `Propuesta ${label}`); y = 18
    }
    frr(doc, 14, y, 182, 10, 2, C.warnBg)
    fnt(doc, 'normal', 8); tc(doc, C.amber)
    doc.text(
      san(`(!) ${occupiedCount} cartel${occupiedCount > 1 ? 'es' : ''} excluido${occupiedCount > 1 ? 's' : ''} por ocupado${occupiedCount > 1 ? 's' : ''} en las fechas solicitadas.`),
      23, y + 7
    )
    y += 14
  }

  return y
}

// ── Página de cierre ──────────────────────────────────────────
function renderClosing(doc, { formData, profile, org, results, activeOption, occupiedSiteIds }) {
  pageBg(doc)
  const orgName    = san(org?.name ?? 'OOH Planner')
  const vendorName = san(profile?.full_name ?? 'Vendedor')

  pageHeader(doc, orgName, 'Cierre')

  let y = 24
  frr(doc, 14, y, 182, 14, 2, C.accent)
  fnt(doc, 'bold', 13); tc(doc, C.white)
  doc.text('Proximos pasos', 18, y + 10)
  y += 22

  const selectedOpt = results
  const DIGITAL_FMT = new Set(['digital', 'urban_furniture_digital'])
  const availSites  = (selectedOpt?.sites ?? []).filter(s => !occupiedSiteIds.has(s.id))
  const totalClient = availSites.reduce((s, x) => s + (x.client_price ?? 0), 0)
  const budget      = Number(formData.budget ?? 0)
  const remaining   = Math.max(0, budget - totalClient)
  // Overrun: total cliente excede presupuesto inicial (por carteles agregados manualmente acordados con el cliente)
  const isOverrun     = budget > 0 && totalClient > budget
  const overrunAmount = isOverrun ? totalClient - budget : 0
  const addedCount    = availSites.filter(s => s.justification === 'Agregado manualmente').length

  // Resumen financiero — alto dinámico según haya overrun (necesita una línea extra de aviso)
  const summaryHeight = isOverrun ? 60 : 50
  frr(doc, 14, y, 182, summaryHeight, 2, C.surface)
  fnt(doc, 'bold', 10); tc(doc, C.light)
  doc.text('Resumen financiero', 18, y + 9)

  fnt(doc, 'normal', 8.5); tc(doc, C.light);  doc.text('Presupuesto aprobado:', 18, y + 18)
  fnt(doc, 'bold');         tc(doc, C.white);  doc.text(peso(budget), 192, y + 18, { align: 'right' })

  fnt(doc, 'normal', 8.5); tc(doc, C.light);  doc.text('Inversion en pauta:', 18, y + 27)
  fnt(doc, 'bold');         tc(doc, isOverrun ? C.amber : C.green);  doc.text(peso(totalClient), 192, y + 27, { align: 'right' })

  if (isOverrun) {
    // Mostrar el monto sobre presupuesto y la nota explicativa
    fnt(doc, 'normal', 8.5); tc(doc, C.light);  doc.text('Sobre presupuesto:', 18, y + 36)
    fnt(doc, 'bold');         tc(doc, C.amber);  doc.text(`+${peso(overrunAmount)}`, 192, y + 36, { align: 'right' })
    fnt(doc, 'normal', 7.5); tc(doc, C.amber)
    const overrunNote = addedCount > 0
      ? (addedCount === 1
          ? 'Incluye 1 cartel agregado posteriormente acordado con el cliente'
          : `Incluye ${addedCount} carteles agregados posteriormente acordados con el cliente`)
      : 'Excede el presupuesto inicial acordado con el cliente'
    doc.text(overrunNote, 18, y + 45)
    fnt(doc, 'normal', 7.5); tc(doc, C.light)
    doc.text(`${availSites.length} soporte${availSites.length !== 1 ? 's' : ''} seleccionado${availSites.length !== 1 ? 's' : ''}`, 18, y + 54)
  } else {
    fnt(doc, 'normal', 8.5); tc(doc, C.light);  doc.text('Presupuesto disponible:', 18, y + 36)
    fnt(doc, 'bold');         tc(doc, remaining > 0 ? C.amber : C.green)
    doc.text(peso(remaining), 192, y + 36, { align: 'right' })
    fnt(doc, 'normal', 7.5); tc(doc, C.light)
    doc.text(`${availSites.length} soporte${availSites.length !== 1 ? 's' : ''} seleccionado${availSites.length !== 1 ? 's' : ''}`, 18, y + 44)
  }
  y += summaryHeight + 8

  // CTA
  frr(doc, 14, y, 182, 28, 3, C.accent)
  fnt(doc, 'bold', 12); tc(doc, C.white)
  doc.text('Aprobamos la propuesta?', 105, y + 12, { align: 'center' })
  fnt(doc, 'normal', 9); tc(doc, [199, 210, 254])
  doc.text(san(`Contacta a ${vendorName} para confirmar y reservar los espacios.`), 105, y + 21, { align: 'center' })
  y += 36

  // Contacto del vendedor
  const contactLines = [
    profile?.phone        ? `Tel: ${profile.phone}` : null,
    profile?.email        ? profile.email            : null,
    profile?.office_hours ? profile.office_hours     : null,
  ].filter(Boolean)

  if (contactLines.length > 0) {
    frr(doc, 14, y, 182, 10 + contactLines.length * 8, 2, C.surface)
    fnt(doc, 'bold', 8.5); tc(doc, C.light)
    doc.text('Contacto:', 18, y + 8)
    contactLines.forEach((line, i) => {
      fnt(doc, 'normal', 8); tc(doc, C.white)
      doc.text(san(line), 18, y + 16 + i * 8)
    })
  }
}

// ── Enriquecimiento de sites ──────────────────────────────────
async function enrichSites(sites, artworks = {}, _org) {
  // Los sites ya vienen enriquecidos desde WizardStep3Results
  // Esta función es extensible para fetch adicional si fuera necesario
  return sites
}

// ── Exports ───────────────────────────────────────────────────

export async function fetchStaticMap(_sites) {
  // Deshabilitado — sin dependencia de servicios externos
  return null
}

export async function generateProposalPDF({
  results,
  formData,
  profile,
  org,
  activeOption    = 'A',
  occupiedSiteIds = new Set(),
  artworkMap      = {},
  artworks,
  mockupMap       = {},
  siteCarasMap    = {},
  mapImage        = null,
  // eslint-disable-next-line no-unused-vars
  mapA, mapB, formatToArt, pdfTheme,
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

  const logoB64 = await toB64(org?.logo_url)

  // Calcular summaryData para KPIs en portada
  const selectedOpt  = results
  const DIGITAL_SET  = new Set(['digital', 'urban_furniture_digital'])
  const coverSites   = (selectedOpt?.sites ?? []).filter(s => !occupiedSiteIds.has(s.id))
  const coverDigital  = coverSites.filter(s =>  DIGITAL_SET.has(s.format))
  const coverPhysical = coverSites.filter(s => !DIGITAL_SET.has(s.format))
  const totalClient  = coverSites.reduce((s, x) => s + (x.client_price || 0), 0)
  const totalImpacts = coverSites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0)
  const summaryData  = {
    totalSites:    coverSites.length,
    digitalCount:  coverDigital.length,
    physicalCount: coverPhysical.length,
    totalImpacts,
    totalClient,
    cpm: totalImpacts > 0 && totalClient > 0
      ? Math.round(totalClient / (totalImpacts / 1000)) : 0,
    optionTitle: san(selectedOpt?.title ?? 'Maximo Alcance'),
  }

  // Portada
  renderCover(doc, { formData, profile, org, logoB64, generatedAt, validUntil, summaryData })

  // Página de opción
  doc.addPage()
  await renderStrategy(doc, {
    option: selectedOpt,
    label:  activeOption,
    formData,
    orgName,
    occupiedIds: occupiedSiteIds,
    mockupMap,
    siteCarasMap,
  })

  // Página de cierre
  doc.addPage()
  renderClosing(doc, { formData, profile, org, results, activeOption, occupiedSiteIds })

  // Página de mapa (si se capturó)
  if (mapImage) {
    doc.addPage()
    pageBg(doc)
    pageHeader(doc, orgName, 'Mapa de ubicaciones')

    let y = 20
    fnt(doc, 'bold', 11); tc(doc, C.white)
    doc.text('Ubicaciones en el mapa', 14, y); y += 10

    // Imagen del mapa — ocupa el ancho completo
    const mapW = 182
    const mapH = 110
    try {
      doc.addImage(mapImage, 'JPEG', 14, y, mapW, mapH)
    } catch { /* ignorar si falla */ }
    y += mapH + 8

    // Leyenda de carteles
    fnt(doc, 'bold', 8); tc(doc, C.light)
    doc.text('Carteles en pauta:', 14, y); y += 6

    const availSites = (selectedOpt?.sites ?? []).filter(s => !occupiedSiteIds.has(s.id))
    for (const site of availSites) {
      if (y > 278) break
      const fmt = FORMAT_MAP[site.format]
      const color = fmt?.color ? hexToRgb(fmt.color) : C.light
      frr(doc, 14, y - 2.5, 3, 3, 1, color)
      fnt(doc, 'normal', 7.5); tc(doc, C.white)
      doc.text(clip(doc, san(site.name ?? ''), 100), 20, y)
      fnt(doc, 'normal', 7); tc(doc, C.light)
      doc.text(clip(doc, san(site.address ?? ''), 70), 122, y)
      y += 6
    }
  }

  // Footers en todas las páginas
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    pageFooter(doc, vendorName, orgName, p, totalPages)
  }

  const safeName = (formData.clientName ?? 'cliente')
    .replace(/[^a-z0-9áéíóúñü\s]/gi, '').replace(/\s+/g, '_')
  doc.save(`Propuesta_${safeName}_${now.toISOString().slice(0, 10)}.pdf`)
}
