/**
 * generateCertificationPDF — v1
 * PDF de certificación de instalación de campaña OOH.
 * Arquitectura idéntica a generateProposalPDF v3.
 * Sin verde/emerald — usar accent (brand) para estados positivos.
 */

import { FORMAT_MAP } from '../../lib/constants'

// ── Paletas (idénticas a generateProposalPDF) ─────────────────
const C_DARK = {
  bg:       [15,  23,  42],
  surface:  [30,  41,  59],
  surface2: [40,  50,  70],
  accent:   [99,  102, 241],
  amber:    [245, 158, 11],
  white:    [248, 250, 252],
  light:    [148, 163, 184],
  muted:    [71,  85,  105],
  infoBg:   [20,  35,  55],
  infoTxt:  [147, 197, 253],
  warnBg:   [45,  35,  10],
  teal:     [20,  184, 166],
}
const C_LIGHT = {
  bg:       [255, 255, 255],
  surface:  [241, 245, 249],
  surface2: [226, 232, 240],
  accent:   [99,  102, 241],
  amber:    [180, 120, 0],
  white:    [15,  23,  42],
  light:    [71,  85,  105],
  muted:    [148, 163, 184],
  infoBg:   [219, 234, 254],
  infoTxt:  [29,  78,  216],
  warnBg:   [254, 243, 199],
  teal:     [15,  118, 110],
}

let C = C_DARK

// ── Dimensiones de foto certificación ────────────────────────
const CERT_PH_W    = 58    // mm — 3 fotos en fila caben en 182mm con 2mm gap
const CERT_PH_H    = 43    // mm — 4:3
const CERT_PH_PXW  = 580
const CERT_PH_PXH  = 435

// ── Helpers de imagen ─────────────────────────────────────────
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

async function cropToCover(dataUrl, pxW = CERT_PH_PXW, pxH = CERT_PH_PXH) {
  if (!dataUrl) return null
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = pxW; canvas.height = pxH
        const ctx   = canvas.getContext('2d')
        const scale = Math.max(pxW / img.width, pxH / img.height)
        const sw = img.width  * scale
        const sh = img.height * scale
        ctx.drawImage(img, (pxW - sw) / 2, (pxH - sh) / 2, sw, sh)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

// ── Helpers de texto ──────────────────────────────────────────
function san(t) {
  if (!t) return ''
  return String(t)
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
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

function impStr(n) {
  const v = Math.round(Number(n ?? 0))
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
  return v.toLocaleString('es-AR')
}

function fmtDatetime(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    const date = d.toLocaleDateString('es-AR',  { day:'2-digit', month:'2-digit', year:'2-digit' })
    const time = d.toLocaleTimeString('es-AR',  { hour:'2-digit', minute:'2-digit' })
    return `${date} ${time}`
  } catch { return '—' }
}

function hexToRgb(hex) {
  if (!hex?.startsWith('#')) return C.accent
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

// ── Draw helpers ──────────────────────────────────────────────
function fr(doc, x, y, w, h, color)           { doc.setFillColor(...color); doc.rect(x, y, w, h, 'F') }
function frr(doc, x, y, w, h, r, color)       { doc.setFillColor(...color); doc.roundedRect(x, y, w, h, r, r, 'F') }
function hl(doc, y, color, x1=14, x2=196)     { doc.setDrawColor(...color); doc.setLineWidth(0.2); doc.line(x1, y, x2, y) }
function tc(doc, color)                        { doc.setTextColor(...color) }
function fnt(doc, style='normal', size=null)   { doc.setFont('helvetica', style); if (size) doc.setFontSize(size) }
function addImg(doc, data, x, y, w, h) {
  if (!data) return
  try { doc.addImage(data, data.startsWith('data:image/png') ? 'PNG' : 'JPEG', x, y, w, h) } catch {}
}

// ── Estructura de página ──────────────────────────────────────
function pageBg(doc) { fr(doc, 0, 0, 210, 297, C.bg) }

function pageHeader(doc, orgName, pageLabel) {
  fr(doc, 0, 0, 210, 10, C.accent)
  fnt(doc, 'bold', 7);   tc(doc, C.white);        doc.text(san(orgName), 14, 7)
  if (pageLabel) {
    fnt(doc, 'normal', 6.5); tc(doc, [199, 210, 254])
    doc.text(san(pageLabel), 196, 7, { align: 'right' })
  }
}

function pageFooter(doc, vendorName, orgName, pageNum, totalPages) {
  fnt(doc, 'normal', 7); tc(doc, C.muted)
  doc.text(san(`${vendorName} · ${orgName}`), 14, 289)
  doc.text(`${pageNum} / ${totalPages}`, 196, 289, { align: 'right' })
}

// ── PORTADA ───────────────────────────────────────────────────
function renderCover(doc, { cert, proposal, profile, org, logoB64, issuedAt, totalSites, certifiedSites, totalPhotos }) {
  pageBg(doc)
  const orgName    = san(org?.name ?? 'OOH Planner')
  const vendorName = san(profile?.full_name ?? '')

  // Header band con logo
  fr(doc, 0, 0, 210, 42, C.accent)
  if (logoB64) { try { doc.addImage(logoB64, 'PNG', 14, 7, 26, 26) } catch {} }
  const tx = logoB64 ? 46 : 14
  fnt(doc, 'bold', 16);  tc(doc, C.white);         doc.text(orgName, tx, 19)
  fnt(doc, 'normal', 9); tc(doc, [199, 210, 254]); doc.text('Certificacion de Instalacion OOH', tx, 28)

  let y = 56

  // Título principal
  fnt(doc, 'bold', 22);   tc(doc, C.white);  doc.text('Certificacion de Campana', 14, y); y += 11
  fnt(doc, 'normal', 14); tc(doc, C.accent); doc.text(san(proposal?.client_name ?? '-'), 14, y); y += 13
  hl(doc, y, C.surface2); y += 7

  // Grilla de datos: 2 columnas
  const leftRows = [
    ['Campana',  san(proposal?.title ?? '-')],
    ['Cliente',  san(proposal?.client_name ?? '-')],
    ['Periodo',  proposal?.start_date ? san(`${proposal.start_date} al ${proposal.end_date ?? '-'}`) : '-'],
    ['Emision',  issuedAt],
    ['Vendedor', vendorName],
  ]
  const rightRows = [
    ['Soportes',   `${totalSites} en campana`],
    ['Certificados', `${certifiedSites} con fotos`],
    ['Total fotos', `${totalPhotos}`],
    ['Estado',     cert.status === 'sent' ? 'Enviada' : 'Borrador'],
    ['Contacto',   san(profile?.email ?? '-')],
  ]

  doc.setFontSize(8.5)
  leftRows.forEach(([lbl, val], i) => {
    const ry = y + i * 7.5
    fnt(doc, 'normal'); tc(doc, C.light); doc.text(lbl + ':', 14, ry)
    fnt(doc, 'bold');   tc(doc, C.white); doc.text(clip(doc, val, 78), 46, ry)
  })
  rightRows.forEach(([lbl, val], i) => {
    const ry = y + i * 7.5
    fnt(doc, 'normal'); tc(doc, C.light);  doc.text(lbl + ':', 112, ry)
    fnt(doc, 'bold');   tc(doc, C.white);  doc.text(clip(doc, val, 58), 152, ry)
  })

  y += leftRows.length * 7.5 + 6
  hl(doc, y, C.surface2); y += 7

  // 3 KPI boxes — sin verde
  const isSent = cert.status === 'sent'
  const kpis = [
    { label: 'Soportes instalados', value: `${certifiedSites}/${totalSites}`, sub: 'con fotos certificadas', hi: certifiedSites === totalSites },
    { label: 'Fotos registradas',   value: String(totalPhotos),               sub: 'en esta certificacion',  hi: totalPhotos > 0              },
    { label: 'Estado',              value: isSent ? 'Enviada' : 'Borrador',   sub: isSent ? 'Al cliente' : 'En proceso', hi: isSent          },
  ]
  const kW = (182 - 8) / 3
  kpis.forEach((k, i) => {
    const kx = 14 + i * (kW + 4)
    frr(doc, kx, y, kW, 26, 2, C.surface)
    fnt(doc, 'normal', 7); tc(doc, C.light);                              doc.text(san(k.label), kx + kW/2, y + 7,  { align: 'center' })
    fnt(doc, 'bold', 14);  tc(doc, k.hi ? C.accent : C.white);            doc.text(san(k.value), kx + kW/2, y + 17, { align: 'center' })
    fnt(doc, 'normal', 6); tc(doc, C.muted);                              doc.text(san(k.sub),   kx + kW/2, y + 23, { align: 'center' })
  })
  y += 30

  // Nota general (si existe)
  if (cert.notes) {
    frr(doc, 14, y, 182, 20, 2, C.infoBg)
    fnt(doc, 'bold', 7.5);   tc(doc, C.infoTxt); doc.text('Nota:', 18, y + 7)
    fnt(doc, 'normal', 7.5); tc(doc, C.white)
    const lines = doc.splitTextToSize(san(cert.notes), 170)
    doc.text(lines.slice(0, 2), 18, y + 14)
    y += 24
  }

  // Caja del vendedor
  y += 4
  const contactParts = [profile?.email, profile?.phone].filter(Boolean)
  const vendorBoxH   = Math.max(28, 20 + contactParts.length * 7)
  frr(doc, 14, y, 182, vendorBoxH, 2, C.surface)
  fnt(doc, 'bold', 8.5);   tc(doc, C.light); doc.text('Preparado por:', 18, y + 7)
  fnt(doc, 'bold', 9);     tc(doc, C.white); doc.text(vendorName, 18, y + 14)
  fnt(doc, 'normal', 7.5); tc(doc, C.light); doc.text(orgName, 18, y + 20)
  let vly = y + 26
  contactParts.forEach(line => {
    fnt(doc, 'normal', 7.5); tc(doc, [165, 180, 252])
    doc.text(san(line), 18, vly); vly += 6
  })
  fnt(doc, 'normal', 7.5); tc(doc, C.light); doc.text('Emitida:', 112, y + 7)
  fnt(doc, 'bold');         tc(doc, C.white); doc.text(issuedAt, 140, y + 7)
}

// ── RESUMEN DE CAMPAÑA (KPIs + formatos) ──────────────────────
function renderSummary(doc, { proposal, orgName, items }) {
  pageBg(doc)
  pageHeader(doc, orgName, 'Resumen de campana')

  let y = 18

  // Banner
  frr(doc, 14, y, 182, 12, 2, C.accent)
  fnt(doc, 'bold', 12); tc(doc, C.white)
  doc.text('Resumen de la campana certificada', 18, y + 8.5)
  y += 16

  // Fechas
  if (proposal?.start_date) {
    frr(doc, 14, y, 182, 10, 2, C.surface)
    fnt(doc, 'normal', 8); tc(doc, C.light); doc.text('Periodo de campana:', 18, y + 7)
    fnt(doc, 'bold', 9);   tc(doc, C.white)
    doc.text(san(`${proposal.start_date} al ${proposal.end_date ?? '-'}`), 80, y + 7)
    y += 14
  }

  // KPI rows DOOH / OOH / Total (misma lógica que proposalPDF)
  const DIGITAL_FMT   = new Set(['digital', 'urban_furniture_digital'])
  const sites         = items.map(i => i.site).filter(Boolean)
  const digitalSites  = sites.filter(s => DIGITAL_FMT.has(s?.format))
  const physicalSites = sites.filter(s => !DIGITAL_FMT.has(s?.format))
  const doohImp       = digitalSites.reduce((s, x)  => s + (x.monthly_impacts ?? 0), 0)
  const offCont       = physicalSites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0)
  const totalImp      = doohImp + offCont

  const kpiRows = []
  if (digitalSites.length > 0)  kpiRows.push(['DOOH', `${digitalSites.length} pantalla${digitalSites.length>1?'s':''}`, doohImp > 0 ? `Impactos: ${impStr(doohImp)}/mes` : ''])
  if (physicalSites.length > 0) kpiRows.push(['OOH',  `${physicalSites.length} soporte${physicalSites.length>1?'s':''}`, offCont > 0 ? `Contactos: ${impStr(offCont)}/mes` : ''])
  kpiRows.push(['Total', `${sites.length} soportes en pauta`, totalImp > 0 ? `Alcance estimado: ${impStr(totalImp)}/mes` : ''])

  kpiRows.forEach(row => {
    frr(doc, 14, y, 182, 10, 2, C.surface)
    fnt(doc, 'bold', 7);   tc(doc, C.light); doc.text(row[0], 18, y + 7)
    fnt(doc, 'normal', 8); tc(doc, C.white); doc.text(san(row[1]), 48, y + 7)
    if (row[2]) { fnt(doc, 'normal', 7.5); tc(doc, C.infoTxt); doc.text(san(row[2]), 108, y + 7) }
    y += 12
  })
  y += 4

  // Desglose por formato
  const byFormat = {}
  for (const s of sites) {
    const key = s?.format ?? 'otro'
    byFormat[key] = (byFormat[key] ?? 0) + 1
  }
  const fmtEntries = Object.entries(byFormat).sort((a, b) => b[1] - a[1])
  if (fmtEntries.length > 0) {
    fnt(doc, 'bold', 9); tc(doc, C.light); doc.text('Formatos en campana', 14, y); y += 7

    const colW = 88
    fmtEntries.forEach(([fmt, count], i) => {
      const col    = i % 2
      const rx     = 14 + col * (colW + 6)
      const fmtInfo = FORMAT_MAP[fmt]
      const color  = fmtInfo?.color ? hexToRgb(fmtInfo.color) : C.accent
      if (col === 0 && i > 0) y += 9
      frr(doc, rx, y - 3, colW, 8, 1, C.surface)
      frr(doc, rx, y - 3, 3, 8, 1, color)
      fnt(doc, 'bold', 7.5);  tc(doc, C.white); doc.text(san(fmtInfo?.label ?? fmt), rx + 7, y + 2)
      fnt(doc, 'normal', 7.5); tc(doc, C.light); doc.text(`${count} soporte${count>1?'s':''}`, rx + colW - 3, y + 2, { align: 'right' })
    })
    y += 14
  }

  // Nota sobre estimaciones
  frr(doc, 14, y, 182, 10, 2, C.surface2)
  fnt(doc, 'normal', 6.5); tc(doc, C.muted)
  doc.text(san('(*) Impactos y contactos son estimaciones basadas en datos de trafico. Pueden variar segun condiciones reales.'), 18, y + 6.5)

  return y
}

// ── MAPA DE UBICACIONES ───────────────────────────────────────
function renderMap(doc, { orgName, mapImage, items }) {
  pageBg(doc)
  pageHeader(doc, orgName, 'Ubicaciones certificadas')

  let y = 18
  fnt(doc, 'bold', 11); tc(doc, C.white); doc.text('Ubicaciones de soportes instalados', 14, y); y += 8

  // Mapa full-width
  const mapW = 182, mapH = 108
  try { doc.addImage(mapImage, 'JPEG', 14, y, mapW, mapH) } catch {}
  y += mapH + 8

  // Leyenda
  fnt(doc, 'bold', 8); tc(doc, C.light); doc.text('Soportes en campana:', 14, y); y += 6
  for (const item of items) {
    if (y > 280) break
    const site    = item.site
    if (!site) continue
    const fmtInfo = FORMAT_MAP[site.format]
    const color   = fmtInfo?.color ? hexToRgb(fmtInfo.color) : C.accent
    frr(doc, 14, y - 2.5, 3, 3, 1, color)
    fnt(doc, 'normal', 7.5); tc(doc, C.white);  doc.text(clip(doc, san(site.name ?? ''), 92), 20, y)
    fnt(doc, 'normal', 7);   tc(doc, C.light);  doc.text(clip(doc, san(site.address ?? ''), 68), 118, y)
    y += 6
  }
}

// ── BLOQUE DE UN CARTEL CON SUS FOTOS ────────────────────────
async function renderSiteBlock(doc, { site, photos, orgName, y, pageLabel }) {
  // Calcular altura del bloque
  const headerH    = 16
  const photoRows  = photos.length > 0 ? Math.ceil(photos.length / 3) : 0
  const photosH    = photoRows * (CERT_PH_H + 8)    // +8 para timestamp
  const noteH      = photos.some(p => p.notes) ? 9 : 0
  const emptyH     = photos.length === 0 ? 9 : 0
  const blockH     = headerH + photosH + noteH + emptyH + 4

  // Salto de página si no cabe
  if (y + blockH > 278) {
    doc.addPage()
    pageBg(doc)
    pageHeader(doc, orgName, pageLabel)
    y = 18
  }

  const fmtInfo  = FORMAT_MAP[site?.format]
  const fmtColor = fmtInfo?.color ? hexToRgb(fmtInfo.color) : C.accent
  const hasCert  = photos.length > 0

  // Fondo del bloque
  frr(doc, 14, y, 182, blockH, 2, C.surface)

  // ── Header del cartel ──
  // Barra de color de formato (3mm a la izquierda)
  frr(doc, 14, y, 3, blockH, 2, fmtColor)

  let hY = y + 5

  // Nombre del cartel
  fnt(doc, 'bold', 9); tc(doc, C.white)
  doc.text(clip(doc, san(site?.name ?? '-'), 130), 21, hY)

  // Badge formato (derecha)
  const fmtLabel = san(fmtInfo?.label ?? (site?.format ?? ''))
  if (fmtLabel) {
    fnt(doc, 'bold', 6); tc(doc, fmtColor)
    doc.text(fmtLabel, 196, hY, { align: 'right' })
  }

  hY += 5

  // Dirección
  fnt(doc, 'normal', 7.5); tc(doc, C.light)
  doc.text(clip(doc, san(site?.address ?? ''), 155), 21, hY)

  // Badge fotos (derecha)
  if (hasCert) {
    frr(doc, 180, hY - 4, 16, 5, 1, C.accent)
    fnt(doc, 'bold', 5.5); tc(doc, C.white)
    doc.text(`${photos.length} foto${photos.length>1?'s':''}`, 188, hY - 0.5, { align: 'center' })
  } else {
    frr(doc, 176, hY - 4, 20, 5, 1, C.muted)
    fnt(doc, 'normal', 5.5); tc(doc, C.white)
    doc.text('Sin fotos', 186, hY - 0.5, { align: 'center' })
  }

  hY += 4
  // Separador fino
  doc.setDrawColor(...C.surface2); doc.setLineWidth(0.15)
  doc.line(21, hY, 196, hY)

  // ── Fotos ──
  const photoStartY = y + headerH
  if (photos.length > 0) {
    const GAP_X = 2
    for (let i = 0; i < photos.length; i++) {
      const col  = i % 3
      const row  = Math.floor(i / 3)
      const px   = 17 + col * (CERT_PH_W + GAP_X)
      const py   = photoStartY + row * (CERT_PH_H + 8)

      if (photos[i]._b64) {
        addImg(doc, photos[i]._b64, px, py, CERT_PH_W, CERT_PH_H)
      } else {
        // Placeholder gris con ícono de cámara
        frr(doc, px, py, CERT_PH_W, CERT_PH_H, 1, C.surface2)
        fnt(doc, 'normal', 6); tc(doc, C.muted)
        doc.text('foto no disponible', px + CERT_PH_W / 2, py + CERT_PH_H / 2, { align: 'center' })
      }

      // Timestamp
      fnt(doc, 'normal', 5.5); tc(doc, C.light)
      doc.text(san(fmtDatetime(photos[i].taken_at)), px + CERT_PH_W / 2, py + CERT_PH_H + 5, { align: 'center' })
    }

    // Nota del cartel (de la primera foto que tenga notas)
    const notePhoto = photos.find(p => p.notes)
    if (notePhoto) {
      const noteY = photoStartY + photoRows * (CERT_PH_H + 8) + 1
      fnt(doc, 'italic', 6.5); tc(doc, C.muted)
      doc.text(clip(doc, san(notePhoto.notes), 172), 21, noteY)
    }
  } else {
    fnt(doc, 'italic', 7); tc(doc, C.muted)
    doc.text('Sin fotos registradas para este soporte.', 21, photoStartY + 6)
  }

  return y + blockH + 3
}

// ── TABLA RESUMEN FINAL ───────────────────────────────────────
function renderSummaryTable(doc, { orgName, items, photosBySite, totalSites, certifiedSites }) {
  pageBg(doc)
  pageHeader(doc, orgName, 'Estado de instalacion')

  let y = 18

  frr(doc, 14, y, 182, 12, 2, C.accent)
  fnt(doc, 'bold', 12); tc(doc, C.white)
  doc.text('Estado de instalacion por soporte', 18, y + 8.5)
  y += 16

  // KPI resumen
  const completePct = totalSites > 0 ? Math.round(certifiedSites / totalSites * 100) : 0
  frr(doc, 14, y, 182, 10, 2, C.surface)
  fnt(doc, 'bold', 8); tc(doc, C.light);  doc.text('Completitud:', 18, y + 7)
  fnt(doc, 'bold', 9); tc(doc, completePct === 100 ? C.accent : C.amber)
  doc.text(`${certifiedSites} de ${totalSites} soportes certificados (${completePct}%)`, 54, y + 7)
  y += 14

  // Barra de progreso simple
  const barW = 182, barH = 4
  frr(doc, 14, y, barW, barH, 2, C.surface2)
  if (completePct > 0) {
    frr(doc, 14, y, barW * completePct / 100, barH, 2, completePct === 100 ? C.accent : C.amber)
  }
  y += 10

  // Header de tabla
  fnt(doc, 'bold', 7.5); tc(doc, C.muted)
  doc.text('Soporte',    18, y)
  doc.text('Direccion',  72, y)
  doc.text('Formato',   138, y)
  doc.text('Fotos',     192, y, { align: 'right' })
  y += 3
  doc.setDrawColor(...C.surface2); doc.setLineWidth(0.2); doc.line(14, y, 196, y)
  y += 5

  // Filas
  for (const item of items) {
    if (y > 278) {
      doc.addPage(); pageBg(doc); pageHeader(doc, orgName, 'Estado de instalacion'); y = 18
    }
    const site    = item.site
    if (!site) continue
    const photos  = photosBySite[item.site_id] ?? []
    const hasCert = photos.length > 0
    const fmtInfo = FORMAT_MAP[site.format]
    const fmtColor = fmtInfo?.color ? hexToRgb(fmtInfo.color) : C.accent

    // Fila alternada
    frr(doc, 14, y - 3.5, 182, 8, 1, C.surface)
    // Barra de color de formato izquierda
    frr(doc, 14, y - 3.5, 3, 8, 0, fmtColor)

    fnt(doc, hasCert ? 'bold' : 'normal', 7.5)
    tc(doc, hasCert ? C.white : C.light)
    doc.text(clip(doc, san(site.name ?? '-'), 48), 20, y)

    fnt(doc, 'normal', 7); tc(doc, C.light)
    doc.text(clip(doc, san(site.address ?? '-'), 60), 72, y)
    doc.text(san(fmtInfo?.label ?? (site.format ?? '-')), 138, y)

    if (hasCert) {
      fnt(doc, 'bold', 7.5); tc(doc, C.accent)
      doc.text(`${photos.length} foto${photos.length>1?'s':''}`, 192, y, { align: 'right' })
    } else {
      fnt(doc, 'normal', 7); tc(doc, C.muted)
      doc.text('pendiente', 192, y, { align: 'right' })
    }
    y += 9
  }
}

// ── EXPORT PRINCIPAL ──────────────────────────────────────────
export async function generateCertificationPDF({ cert, profile, org, mapImage = null, pdfTheme = 'dark' }) {
  const { jsPDF } = await import('jspdf')
  C = pdfTheme === 'light' ? C_LIGHT : C_DARK

  const doc       = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const proposal  = cert.proposal
  const items     = proposal?.proposal_items ?? []
  const photos    = cert.photos ?? []
  const orgName   = san(org?.name ?? 'OOH Planner')
  const vendorName = san(profile?.full_name ?? '')

  // Agrupar fotos por site_id
  const photosBySite = photos.reduce((acc, p) => {
    const key = p.site_id ?? '__no_site__'
    ;(acc[key] ??= []).push(p)
    return acc
  }, {})

  // Métricas globales
  const certifiedSites = new Set(photos.map(p => p.site_id).filter(Boolean)).size
  const totalSites     = items.length
  const totalPhotos    = photos.length

  const now      = new Date()
  const issuedAt = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const logoB64  = await toB64(org?.logo_url)

  // Pre-fetch y crop de todas las fotos (paralelo)
  await Promise.all(photos.map(async p => {
    try {
      const raw = await toB64(p.photo_url)
      p._b64 = raw ? await cropToCover(raw) : null
    } catch { p._b64 = null }
  }))

  // ── Pág. 1: Portada ──────────────────────────────────────────
  renderCover(doc, { cert, proposal, profile, org, logoB64, issuedAt, totalSites, certifiedSites, totalPhotos })

  // ── Pág. 2: Resumen de campaña ───────────────────────────────
  doc.addPage()
  renderSummary(doc, { proposal, orgName, items })

  // ── Pág. 3: Mapa (opcional) ──────────────────────────────────
  if (mapImage) {
    doc.addPage()
    renderMap(doc, { orgName, mapImage, items })
  }

  // ── Págs. de fotos por cartel ────────────────────────────────
  doc.addPage()
  pageBg(doc)
  pageHeader(doc, orgName, 'Soportes certificados')
  let y = 18

  for (const item of items) {
    const site       = item.site
    if (!site) continue
    const sitePhotos = photosBySite[item.site_id] ?? []
    y = await renderSiteBlock(doc, {
      site, photos: sitePhotos, orgName, y,
      pageLabel: 'Soportes certificados',
    })
  }

  // Edge case: fotos sin site_id asignado
  const unsited = photosBySite['__no_site__'] ?? []
  if (unsited.length > 0) {
    y = await renderSiteBlock(doc, {
      site: { name: 'Sin soporte asignado', address: '', format: null },
      photos: unsited, orgName, y,
      pageLabel: 'Soportes certificados',
    })
  }

  // ── Última pág.: Tabla resumen ───────────────────────────────
  doc.addPage()
  renderSummaryTable(doc, { orgName, items, photosBySite, totalSites, certifiedSites })

  // ── Footers en todas las páginas ─────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    pageFooter(doc, vendorName, orgName, p, totalPages)
  }

  // ── Guardar ───────────────────────────────────────────────────
  const safeClient = (proposal?.client_name ?? 'cliente')
    .replace(/[^a-z0-9áéíóúñü\s]/gi, '').replace(/\s+/g, '_')
  doc.save(`Certificacion_${safeClient}_${now.toISOString().slice(0, 10)}.pdf`)
}
