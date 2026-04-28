/**
 * InventoryOnboardingWizard
 * Modal full-screen de 6 pasos para carga inicial de inventario.
 *
 * MIGRACIÓN REQUERIDA — ejecutar en Supabase SQL Editor:
 *   ALTER TABLE organisations ADD COLUMN IF NOT EXISTS onboarding_step int DEFAULT 0;
 */

import { useState, useRef, useEffect } from 'react'
import {
  X, Upload, CheckCircle, ChevronLeft, ChevronRight,
  Loader2, Sparkles, FileText, Image, AlertCircle, Download,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

// ── Pasos ─────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Ubicaciones',    desc: 'Cargá tu lista de carteles' },
  { id: 2, label: 'Imágenes',       desc: 'Fotos de cada ubicación' },
  { id: 3, label: 'Tarifas',        desc: 'Precios y condiciones' },
  { id: 4, label: 'Disponibilidad', desc: 'Estado de ocupación' },
  { id: 5, label: 'Audiencias',     desc: 'Tráfico e impacto' },
  { id: 6, label: 'Resumen',        desc: 'Revisión y finalización' },
]

// ── Formatos válidos ──────────────────────────────────────────────────────────

const FORMAT_OPTIONS = [
  'billboard', 'digital', 'ambient', 'poster',
  'urban_furniture', 'urban_furniture_digital',
  'mobile_screen', 'transit', 'street_furniture',
]

const FORMAT_LABELS = {
  billboard:              'Espectacular / Gran Formato',
  digital:                'Digital / LED',
  ambient:                'Medianera / Top Wall',
  poster:                 'Afiche papel',
  urban_furniture:        'Mobiliario Urbano iluminado',
  urban_furniture_digital:'Mobiliario Digital',
  mobile_screen:          'Pantalla Móvil',
  transit:                'Transporte / Subte',
  street_furniture:       'Mobiliario sin luz / Papel',
}

// ── Mapeo de nombres coloquiales a valores del schema ─────────────────────────

const FORMAT_KEYWORD_MAP = {
  // billboard
  'espectacular': 'billboard', 'espectaculares': 'billboard',
  'columna': 'billboard', 'monocolumna': 'billboard',
  'cartel': 'billboard', 'carteles': 'billboard',
  'valla': 'billboard', 'vallas': 'billboard',
  'frontlight': 'billboard', 'front light': 'billboard',
  'backlight': 'billboard', 'back light': 'billboard',
  'séxtuple': 'billboard', 'sextuple': 'billboard',
  'gran formato': 'billboard', 'gran_formato': 'billboard',
  'estructura': 'billboard', 'billboard': 'billboard',
  'cartelera': 'billboard', 'lona': 'billboard',
  // ambient
  'medianera': 'ambient', 'medianeras': 'ambient',
  'top wall': 'ambient', 'topwall': 'ambient',
  'fachada': 'ambient', 'mural': 'ambient',
  'pendón': 'ambient', 'pendon': 'ambient',
  'ambient': 'ambient',
  // digital
  'digital': 'digital', 'led': 'digital',
  'dooh': 'digital', 'pantalla': 'digital',
  'pantalla led': 'digital', 'pantalla digital': 'digital',
  'totem': 'digital', 'tótem': 'digital',
  'pantalla vial': 'digital', 'pantalla medianera': 'digital',
  'display': 'digital', 'screen': 'digital',
  // poster
  'afiche': 'poster', 'afiches': 'poster',
  'poster': 'poster', 'papel': 'poster',
  'gigantografía': 'poster', 'gigantografia': 'poster',
  'cartel papel': 'poster',
  // urban_furniture (con luz)
  'mobiliario': 'urban_furniture', 'urban_furniture': 'urban_furniture',
  'pupi': 'urban_furniture', 'pupis': 'urban_furniture',
  'refugio': 'urban_furniture', 'refugios': 'urban_furniture',
  'parada': 'urban_furniture', 'kiosco': 'urban_furniture',
  'columna publicitaria': 'urban_furniture',
  'cara pantalla': 'urban_furniture', 'mupie': 'urban_furniture',
  'mupi': 'urban_furniture',
  // urban_furniture_digital
  'urban_furniture_digital': 'urban_furniture_digital',
  'mobiliario digital': 'urban_furniture_digital',
  'mupi digital': 'urban_furniture_digital',
  'pupi digital': 'urban_furniture_digital',
  'refugio digital': 'urban_furniture_digital',
  // mobile_screen
  'mobile_screen': 'mobile_screen',
  'móvil': 'mobile_screen', 'movil': 'mobile_screen',
  'pantalla móvil': 'mobile_screen', 'camion led': 'mobile_screen',
  'camión led': 'mobile_screen', 'luneta': 'mobile_screen',
  'colectivo': 'mobile_screen',
  // transit
  'transit': 'transit', 'subte': 'transit',
  'andén': 'transit', 'anden': 'transit',
  'transiluminado': 'transit', 'transporte': 'transit',
  'panel andén': 'transit', 'panel anden': 'transit',
  // street_furniture (sin luz, papel)
  'street_furniture': 'street_furniture',
  'soporte papel': 'street_furniture',
  'cerco': 'street_furniture',
  'valla obra': 'street_furniture',
  'refugio sin luz': 'street_furniture',
  'pupi sin luz': 'street_furniture',
  'columna sin luz': 'street_furniture',
}

function mapFormat(val) {
  if (!val) return 'billboard'
  const l = String(val).toLowerCase().trim()
  if (FORMAT_KEYWORD_MAP[l]) return FORMAT_KEYWORD_MAP[l]
  if (FORMAT_OPTIONS.includes(l)) return l
  return 'billboard'
}

// ── Mapeo de encabezados de planilla → claves internas ────────────────────────

const HEADER_ALIASES = {
  code:      ['código','codigo','code','cod','id','identificador','cód'],
  name:      ['nombre','name','descripcion','descripción','descripcion'],
  address:   ['dirección','direccion','address','ubicación','ubicacion','domicilio'],
  city:      ['ciudad','city','localidad'],
  format:    ['formato','format','tipo','type','tipo_soporte'],
  width_m:         ['ancho','width','ancho_m','ancho (m)','ancho m','width_m'],
  height_m:        ['alto','height','alto_m','alto (m)','alto m','altura','height_m'],
  print_width_cm:  ['ancho_impresion_cm','ancho impresion','ancho impresión','print_width_cm','ancho_impresion'],
  print_height_cm: ['alto_impresion_cm','alto impresion','alto impresión','print_height_cm','alto_impresion'],
  owner_type:['propietario','owner','owner_type','tipo_propiedad','propiedad'],
  illuminated:['iluminado','illuminated','ilum','luz','iluminación','iluminacion'],
  latitude:  ['latitud','latitude','lat'],
  longitude: ['longitud','longitude','lng','lon','long'],
  base_rate: ['precio_base','precio base','base_rate','tarifa','precio','precio mensual','precio_mensual'],
  sale_price:['precio_venta','precio venta','sale_price','precio de venta'],
  faces_count:['caras','faces','faces_count','cantidad_caras','cantidad de caras'],
  traffic_direction:['direccion_trafico','dirección tráfico','traffic_direction'],
  is_available:['disponible','available','is_available','disponibilidad'],
}

function mapHeaders(row) {
  const mapped = {}
  const rowKeys = Object.keys(row)
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const match = rowKeys.find(k =>
      aliases.some(a => k.toLowerCase().trim() === a || k.toLowerCase().trim().includes(a))
    )
    if (match !== undefined) mapped[field] = row[match]
  }
  return mapped
}

// ── AI mapping de columnas (fallback a HEADER_ALIASES si falla) ───────────────

const INVENTORY_SCHEMA_FIELDS = [
  'code', 'name', 'address', 'city', 'format',
  'width_m', 'height_m', 'print_width_cm', 'print_height_cm',
  'owner_type', 'illuminated', 'latitude', 'longitude',
  'base_rate', 'sale_price', 'faces_count', 'traffic_direction',
  'is_available', '__ignore__',
]

async function aiMapColumnsInventory(columns, sampleRows) {
  const samples = columns.slice(0, 30).map(col => {
    const vals = sampleRows.map(r => String(r[col] ?? '')).filter(Boolean).slice(0, 3)
    return `"${col}": [${vals.map(v => `"${String(v).slice(0, 40)}"`).join(', ')}]`
  }).join('\n')

  const prompt = `Mapeá columnas de una planilla de inventario de carteles publicitarios OOH.

Schema válido: ${INVENTORY_SCHEMA_FIELDS.join(', ')}

Descripción de campos:
- code: código o ID único del cartel
- name: nombre o descripción del cartel
- address: dirección física
- city: ciudad o localidad
- format: tipo de soporte (espectacular, digital, medianera, afiche, etc.)
- width_m / height_m: dimensiones en metros
- print_width_cm / print_height_cm: medidas de impresión en cm
- owner_type: propiedad (propio/alquilado)
- illuminated: si tiene iluminación (booleano)
- latitude / longitude: coordenadas GPS
- base_rate: precio mensual / tarifa base
- sale_price: precio de venta
- faces_count: cantidad de caras
- traffic_direction: dirección del tráfico
- is_available: disponibilidad actual
- __ignore__: columnas irrelevantes (números correlativos, notas internas, etc.)

Columnas con muestras:
${samples}

Respondé SOLO con JSON: {"columna": "campo"}. Sin markdown.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    const validIds = new Set(INVENTORY_SCHEMA_FIELDS)
    const safe = {}
    columns.forEach(col => {
      const s = parsed[col]
      safe[col] = validIds.has(s) ? s : '__ignore__'
    })
    return safe
  } catch {
    return null  // fallback a HEADER_ALIASES
  }
}

// Aplica AI mapping a una fila cruda → objeto con claves del schema
function applyAiMapping(row, aiMapping) {
  const mapped = {}
  Object.entries(aiMapping).forEach(([col, field]) => {
    if (field === '__ignore__') return
    const val = row[col]
    if (val !== undefined && val !== '') mapped[field] = val
  })
  return mapped
}

// ── Normalización de una fila ─────────────────────────────────────────────────

function normalizeRow(raw) {
  const toBool = v => {
    if (typeof v === 'boolean') return v
    const s = String(v ?? '').toLowerCase().trim()
    return s === 'true' || s === '1' || s === 'si' || s === 'sí' || s === 'yes'
  }
  const toNum = v => {
    const n = Number(v)
    return v != null && v !== '' && !isNaN(n) ? n : null
  }
  return {
    code:              String(raw.code ?? '').trim(),
    name:              String(raw.name ?? '').trim(),
    address:           String(raw.address ?? '').trim(),
    city:              String(raw.city ?? '').trim(),
    format:            mapFormat(raw.format),
    width_m:           toNum(raw.width_m),      // renamed to width_ft in DB
    height_m:          toNum(raw.height_m),     // renamed to height_ft in DB
    owner_type:        raw.owner_type === 'rented' ? 'rented' : 'owned',
    illuminated:       toBool(raw.illuminated),
    is_available:      raw.is_available === false || String(raw.is_available).toLowerCase() === 'false' ? false : true,
    latitude:          toNum(raw.latitude),
    longitude:         toNum(raw.longitude),
    base_rate:         toNum(raw.base_rate),
    sale_price:        toNum(raw.sale_price),       // display only (no DB column yet)
    faces_count:       raw.faces_count ? Number(raw.faces_count) : 1,  // display only
    traffic_direction: String(raw.traffic_direction ?? '').trim() || null, // display only
    print_width_cm:    toNum(raw.print_width_cm),
    print_height_cm:   toNum(raw.print_height_cm),
  }
}

// Construye el payload para insertar en inventory (solo columnas existentes en DB)
function toDbPayload(item, orgId) {
  return {
    org_id:            orgId,
    code:              item.code || null,
    name:              item.name || null,
    address:           item.address || null,
    city:              item.city || null,
    format:            item.format,
    width_m:           item.width_m,
    height_m:          item.height_m,
    width_ft:          item.width_m ? Math.round(item.width_m / 0.3048 * 100) / 100 : null,
    height_ft:         item.height_m ? Math.round(item.height_m / 0.3048 * 100) / 100 : null,
    owner_type:        item.owner_type,
    illuminated:       item.illuminated,
    is_available:      item.is_available,
    latitude:          item.latitude,
    longitude:         item.longitude,
    base_rate:         item.base_rate,
    sale_price:        item.sale_price,
    faces_count:       item.faces_count ?? 1,
    traffic_direction: item.traffic_direction || null,
    print_width_cm:    item.print_width_cm ?? null,
    print_height_cm:   item.print_height_cm ?? null,
  }
}

// ── Claude API (PDF / imagen) ─────────────────────────────────────────────────

const CLAUDE_SYSTEM_PROMPT = `Sos un asistente especializado en inventario de publicidad exterior (OOH).
Extraé todos los carteles o ubicaciones del archivo y devolvé ÚNICAMENTE un array JSON sin texto adicional.

Campos por cartel (usa null cuando no disponible):
- code (string): código único
- name (string): nombre del cartel
- address (string): dirección física
- city (string): ciudad
- format: uno de estos valores exactos:
    "billboard" → espectacular, monocolumna, frontlight, backlight, séxtuple, valla iluminada, gran formato, cartel, lona
    "ambient" → medianera, top wall, fachada, pendón, mural
    "digital" → pantalla LED, tótem digital, DOOH, pantalla vial, pantalla medianera LED
    "urban_furniture" → pupi iluminado, refugio iluminado, columna publicitaria, MUPI, mobiliario urbano con luz
    "urban_furniture_digital" → pupi digital, refugio digital, MUPI digital, mobiliario digital
    "poster" → afiche papel, gigantografía, cartel papel
    "mobile_screen" → pantalla móvil, camión LED, luneta de colectivo
    "transit" → subte, andén, transiluminado, panel de transporte
    "street_furniture" → mobiliario sin iluminación, soporte papel, cerco de obra, valla sin luz
    Si dudás, usá "billboard". NUNCA devuelvas un valor fuera de esta lista.
- width_m (number|null): ancho en metros
- height_m (number|null): alto en metros
- owner_type: "owned" o "rented"
- illuminated (boolean)
- latitude (number|null)
- longitude (number|null)
- base_rate (number|null): precio mensual
- sale_price (number|null): precio de venta
- faces_count (number, default 1)
- traffic_direction (string|null)
- is_available (boolean, default true)

IMPORTANTE: Los precios son en pesos argentinos (ARS), no en dólares.

Ejemplo de respuesta: [{"code":"BC001","name":"Espectacular Corrientes","address":"Av. Corrientes 1234","city":"Buenos Aires","format":"billboard","width_m":12,"height_m":4,"owner_type":"owned","illuminated":true,"latitude":-34.6037,"longitude":-58.3816,"base_rate":800,"sale_price":null,"faces_count":1,"traffic_direction":"Norte","is_available":true}]`

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Procesa una imagen (no PDF) con Claude
async function callClaudeWithImage(file) {
  const base64 = await fileToBase64(file)

  // Base64 es ~33% más grande que el binario; 33M chars ≈ 25 MB originales
  if (base64.length > 33_000_000) {
    throw new Error('El archivo supera los 25 MB. Dividilo en partes más pequeñas e importalas por separado.')
  }

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system:     CLAUDE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
          { type: 'text',  text: 'Extraé todos los carteles/ubicaciones y devolvé el array JSON.' },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Error ${res.status} al llamar a Claude API${body ? ': ' + body.slice(0, 120) : ''}`)
  }

  const data  = await res.json()
  const text  = data.content?.[0]?.text ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No se pudo extraer JSON de la respuesta de IA')
  return JSON.parse(match[0])
}

// Procesa un PDF página por página con pdfjs-dist y manda batches de 3 a Claude
async function processPdfWithAI(file, systemPrompt, onProgress) {
  // 1. Cargar pdfjs
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  // 2. Leer el archivo como ArrayBuffer
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages = pdf.numPages

  // 3. Renderizar cada página como JPEG comprimido (~200-400KB por página)
  const pageImages = []
  for (let i = 1; i <= totalPages; i++) {
    onProgress?.(`Procesando página ${i} de ${totalPages}…`)
    const page     = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.2 })
    const canvas   = document.createElement('canvas')
    canvas.width   = viewport.width
    canvas.height  = viewport.height
    const ctx      = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
    pageImages.push(base64)
  }

  // 4. Procesar en batches de 3 páginas
  const BATCH_SIZE = 3
  let allItems = []

  for (let b = 0; b < pageImages.length; b += BATCH_SIZE) {
    const batch       = pageImages.slice(b, b + BATCH_SIZE)
    const batchNum    = Math.floor(b / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(pageImages.length / BATCH_SIZE)
    onProgress?.(`Analizando con IA — batch ${batchNum} de ${totalBatches}…`)

    const content = [
      ...batch.map(b64 => ({
        type:   'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: b64 },
      })),
      {
        type: 'text',
        text: 'Extraé todos los carteles publicitarios de estas imágenes y devolvé ÚNICAMENTE el array JSON, sin texto adicional.',
      },
    ]

    const response = await fetch('/api/claude', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       'claude-haiku-4-5-20251001',
        max_tokens:  4000,
        temperature: 0,
        system:      systemPrompt,
        messages:    [{ role: 'user', content }],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(`Error en batch ${batchNum}: ${err.error || response.status}`)
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''

    try {
      const clean = text.replace(/```json|```/g, '').trim()
      const match = clean.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0])
        allItems = [...allItems, ...parsed]
      }
    } catch {
      // Si un batch no devuelve JSON válido, continuamos con el siguiente
      console.warn(`Batch ${batchNum} no devolvió JSON válido:`, text.slice(0, 100))
    }
  }

  return allItems
}

// ── Parseo local de Excel / CSV ───────────────────────────────────────────────

async function parseSpreadsheet(file) {
  const XLSXmod = await import('xlsx')
  const XLSX = XLSXmod.default ?? XLSXmod
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  // Auto-detectar hoja con más datos
  let bestSheet = wb.SheetNames[0]
  let maxRows = 0
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    if (rows.length > maxRows) { maxRows = rows.length; bestSheet = name }
  }

  const ws = wb.Sheets[bestSheet]

  // Detectar si hay headers válidos o son __EMPTY_X
  const rawAll = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 })
  let rows
  if (rawAll.length > 0) {
    const firstRow = rawAll[0]
    const allEmpty = firstRow.every(c => !c || String(c).trim() === '')
    const hasEmptyHeaders = XLSX.utils.sheet_to_json(ws, { defval: '' })
      .slice(0, 1)
      .every(r => Object.keys(r).every(k => /^__EMPTY/.test(k)))

    if (allEmpty || hasEmptyHeaders) {
      // Primera fila vacía → buscar fila con headers
      let headerIdx = 0
      for (let i = 0; i < Math.min(rawAll.length, 6); i++) {
        if (rawAll[i].filter(v => v !== '' && v != null).length >= 2) {
          headerIdx = i; break
        }
      }
      const headers = rawAll[headerIdx].map((h, i) => String(h ?? '').trim() || `Col_${i + 1}`)
      rows = rawAll.slice(headerIdx + 1)
        .filter(r => r.some(v => v !== '' && v != null))
        .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])))
    } else {
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    }
  } else {
    rows = []
  }

  if (!rows.length) return []

  // AI mapping sobre los primeros 8 registros
  const columns = Object.keys(rows[0])
  const aiMapping = await aiMapColumnsInventory(columns, rows.slice(0, 8))

  if (aiMapping) {
    // Usar AI mapping
    return rows.map(row => normalizeRow(applyAiMapping(row, aiMapping)))
  } else {
    // Fallback a HEADER_ALIASES
    return rows.map(row => normalizeRow(mapHeaders(row)))
  }
}

async function parseDocx(file) {
  const mammoth = await import('mammoth')
  const buf = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer: buf })
  const parser = new DOMParser()
  const doc = parser.parseFromString(result.value, 'text/html')
  const tables = doc.querySelectorAll('table')
  if (!tables.length) throw new Error('No se encontró ninguna tabla en el documento Word.')
  const table = tables[0]
  const tableRows = Array.from(table.querySelectorAll('tr'))
  if (tableRows.length < 2) throw new Error('La tabla del documento está vacía.')
  const headers = Array.from(tableRows[0].querySelectorAll('td,th'))
    .map((c, i) => c.textContent.trim() || `Col_${i + 1}`)
  const rows = tableRows.slice(1)
    .map(row => {
      const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.textContent.trim())
      const obj = {}
      headers.forEach((h, i) => { obj[h] = cells[i] ?? '' })
      return obj
    })
    .filter(r => Object.values(r).some(v => v))

  if (!rows.length) return []
  const columns = Object.keys(rows[0])
  const aiMapping = await aiMapColumnsInventory(columns, rows.slice(0, 8))
  return rows.map(row => normalizeRow(aiMapping ? applyAiMapping(row, aiMapping) : mapHeaders(row)))
}

// ── Helpers de formato ───────────────────────────────────────────────────────

function fmtARS(val) {
  if (val == null || val === '') return '—'
  return '$' + Math.round(Number(val)).toLocaleString('es-AR')
}
function fmtPct(val) {
  if (val == null || val === '') return '—'
  return Number(val).toFixed(2).replace('.', ',') + '%'
}
function fmtNum(val) {
  if (val == null || val === '') return '—'
  return Math.round(Number(val)).toLocaleString('es-AR')
}

// ── System prompts para pasos 3, 4 y 5 ──────────────────────────────────────

const SYSTEM_PROMPT_COSTS = `Sos un asistente especializado en publicidad exterior OOH argentina.
Analizá el contenido de estas hojas de cálculo y detectá datos de COSTOS o TARIFAS de carteles publicitarios.
Devolvé ÚNICAMENTE un array JSON sin texto adicional:
[{
  "code": "string",
  "base_rate": number|null,
  "biweekly_rate": number|null,
  "sale_price": number|null,
  "cost_rent": number|null,
  "cost_electricity": number|null,
  "cost_taxes": number|null,
  "cost_maintenance": number|null,
  "cost_imponderables": number|null,
  "cost_print_per_m2": number|null,
  "cost_colocation": number|null,
  "cost_design": number|null,
  "cost_seller_commission_pct": number|null,
  "cost_agency_commission_pct": number|null,
  "asociado_nombre": "string|null",
  "cost_owner_commission_pct": number|null
}]
REGLAS: valores monetarios en ARS (pesos argentinos). Porcentajes entre 0 y 100, nunca decimales como 0.05. code es crítico para el match con el inventario. Solo JSON array, sin texto adicional.`

const SYSTEM_PROMPT_AVAIL = `Analizá estas hojas y detectá datos de DISPONIBILIDAD u OCUPACIÓN de carteles publicitarios.
Devolvé ÚNICAMENTE un array JSON:
[{
  "code": "string",
  "is_available": boolean,
  "available_until": "string|null"
}]
REGLAS: is_available true si está libre, false si ocupado. Interpretá "activo","disponible","libre","free" como true. Interpretá "ocupado","vendido","en campaña" como false. available_until en formato YYYY-MM-DD si aplica, null si no. Solo JSON array, sin texto adicional.`

const SYSTEM_PROMPT_AUDIENCE = `Analizá estas hojas y detectá datos de AUDIENCIA, TRÁFICO o IMPACTOS de carteles publicitarios.
Devolvé ÚNICAMENTE un array JSON:
[{
  "code": "string",
  "daily_traffic": number|null,
  "cluster_audiencia": "string|null",
  "audience_source": "propio"
}]
REGLAS: daily_traffic siempre DIARIO. Si el archivo tiene semanal dividí por 7, si tiene mensual dividí por 30. Redondeá al entero más cercano. cluster_audiencia: descripción del segmento si existe. audience_source siempre "propio". Solo JSON array, sin texto adicional.`

// ── Estado de validación por fila ─────────────────────────────────────────────

function rowStatus(item) {
  if (!item.code || !item.name) return 'error'   // rojo
  if (!item.address)             return 'warning' // amarillo
  return 'ok'                                     // verde
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function InventoryOnboardingWizard({ onClose, onComplete }) {
  const { profile } = useAuth()
  const orgId = profile?.org_id ?? null
  const [step,       setStep]       = useState(1)
  const [savedSteps, setSavedSteps] = useState(new Set())

  // Step 1 state
  // Step 1
  const [file,          setFile]          = useState(null)
  const [pdfFile,       setPdfFile]       = useState(null)
  const [parsing,       setParsing]       = useState(false)
  const [parseProgress, setParseProgress] = useState('')
  const [parseError,    setParseError]    = useState('')
  const [items,         setItems]         = useState([])
  const [importing,     setImporting]     = useState(false)
  const [importedCount, setImportedCount] = useState(null)
  const [importedItems, setImportedItems] = useState([])

  // Archivo del paso 1 en memoria (xlsx/csv) + cache de análisis IA
  const [step1File,     setStep1File]     = useState(null)
  const [step1Analysis, setStep1Analysis] = useState({})

  // Step 2
  const [photosPreviews,   setPhotosPreviews]   = useState([])
  const [photosExtracting, setPhotosExtracting] = useState(false)
  const [photosUploading,  setPhotosUploading]  = useState(false)
  const [photosUploaded,    setPhotosUploaded]    = useState(false)
  const [photosError,       setPhotosError]       = useState('')
  const [photosFailedCount, setPhotosFailedCount] = useState(0)

  // Step 3 — Costos
  const [costsPreview,   setCostsPreview]   = useState([])
  const [costsUploading, setCostsUploading] = useState(false)
  const [costsUploaded,  setCostsUploaded]  = useState(false)
  const [costsError,     setCostsError]     = useState('')

  // Step 4 — Disponibilidad
  const [availPreview,   setAvailPreview]   = useState([])
  const [availUploading, setAvailUploading] = useState(false)
  const [availUploaded,  setAvailUploaded]  = useState(false)
  const [availError,     setAvailError]     = useState('')

  // Step 5 — Audiencias
  const [audiencePreview,   setAudiencePreview]   = useState([])
  const [audienceUploading, setAudienceUploading] = useState(false)
  const [audienceUploaded,  setAudienceUploaded]  = useState(false)
  const [audienceError,     setAudienceError]     = useState('')

  const fileInputRef  = useRef(null)
  const fileInputSRef = useRef(null) // ref compartido para dropzones de pasos 3-5
  const isDirty      = items.length > 0 && importedCount === null

  // ── Cierre ─────────────────────────────────────────────────────────────────

  function handleClose() {
    if (isDirty && !window.confirm('¿Salir del asistente? Los datos sin importar se perderán.')) return
    onClose()
  }

  // ── Navegación ──────────────────────────────────────────────────────────────

  function goPrev() { if (step > 1) setStep(s => s - 1) }
  function goNext() {
    if (step < STEPS.length) setStep(s => s + 1)
    else onComplete?.()
  }

  // ── Marcar paso guardado ────────────────────────────────────────────────────

  async function markStepSaved(stepId) {
    setSavedSteps(prev => new Set([...prev, stepId]))
    try {
      await supabase.from('organisations').update({ onboarding_step: stepId }).eq('id', orgId)
    } catch (_) {} // columna puede no existir aún
  }

  // ── Procesamiento de archivo ────────────────────────────────────────────────

  async function handleFile(f) {
    if (!f) return
    setFile(f)
    setParsing(true)
    setParseProgress('')
    setParseError('')
    setItems([])
    setImportedCount(null)

    try {
      const ext = f.name.split('.').pop().toLowerCase()
      let parsed = []

      if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
        setStep1File(f)
        parsed = await parseSpreadsheet(f)
      } else if (ext === 'csv') {
        setStep1File(f)
        // CSV → parseSpreadsheet también lo maneja via XLSX
        parsed = await parseSpreadsheet(f)
      } else if (ext === 'docx') {
        setStep1File(f)
        parsed = await parseDocx(f)
      } else if (ext === 'pdf' || f.type === 'application/pdf') {
        // PDF → guardar en memoria + renderizar páginas con pdfjs + batches a Claude
        setPdfFile(f)
        const raw = await processPdfWithAI(f, CLAUDE_SYSTEM_PROMPT, setParseProgress)
        parsed = Array.isArray(raw) ? raw.map(r => normalizeRow(r)) : []
      } else {
        // Imagen → Claude directo
        const raw = await callClaudeWithImage(f)
        parsed = Array.isArray(raw) ? raw.map(r => normalizeRow(r)) : []
      }

      if (parsed.length === 0) throw new Error('No se encontraron carteles en el archivo')
      setItems(parsed)
    } catch (err) {
      setParseError(err.message)
      setFile(null)
    } finally {
      setParsing(false)
      setParseProgress('')
    }
  }

  function handleFileInput(e) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  // ── Edición inline de celdas ────────────────────────────────────────────────

  function updateItem(idx, field, value) {
    setItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  // ── Importar ────────────────────────────────────────────────────────────────

  async function handleImport() {
    setImporting(true)
    setParseError('')
    try {
      const validRaw = items.filter(i => i.code && i.name)
      if (validRaw.length === 0) throw new Error('No hay carteles con código y nombre completos para importar')
      // Deduplicar por código — si el PDF generó duplicados, quedarse con el último
      const seen = new Map()
      validRaw.forEach(item => seen.set(item.code, item))
      const valid = Array.from(seen.values())

      const rows = valid.map(item => toDbPayload(item, orgId))
      const { error } = await supabase.from('inventory')
        .upsert(rows, {
          onConflict:       'org_id,code',
          ignoreDuplicates: false,
        })
      if (error) throw new Error(error.message)

      // Enriquecer daily_traffic con fuentes oficiales (fire & forget)
      supabase.functions.invoke('enrich-billboard-audience', {
        body: { org_id: orgId }
      }).catch(e => console.warn('enrich-billboard-audience:', e))

      setImportedCount(valid.length)
      setImportedItems(valid)
      await markStepSaved(1)
      return valid.length
    } catch (err) {
      setParseError(err.message)
      return null
    } finally {
      setImporting(false)
    }
  }

  // ── Paso 2: extraer fotos del PDF ──────────────────────────────────────────

  async function extractPhotosFromPdf() {
    if (!pdfFile || photosExtracting || photosPreviews.length > 0) return
    setPhotosExtracting(true)
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()

      const arrayBuffer = await pdfFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const previews = []

      for (let i = 1; i <= pdf.numPages; i++) {
        setParseProgress(`Procesando página ${i} de ${pdf.numPages}...`)
        const page     = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas   = document.createElement('canvas')
        canvas.width   = viewport.width
        canvas.height  = viewport.height
        const ctx      = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport }).promise

        let quality = 0.8
        let base64  = canvas.toDataURL('image/jpeg', quality).split(',')[1]
        while (base64.length > 933_000 && quality > 0.3) {
          quality -= 0.1
          base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1]
        }

        const matchedItem = importedItems[i - 1] ?? null
        previews.push({
          pageNum:     i,
          base64,
          matchedCode: matchedItem?.code ?? null,
          matchedName: matchedItem?.name ?? null,
          selected:    !!matchedItem,
        })
      }
      setPhotosPreviews(previews)
    } catch (err) {
      console.error('Error extrayendo fotos:', err)
      setPhotosError('No se pudieron extraer las fotos del PDF.')
    } finally {
      setPhotosExtracting(false)
    }
  }

  function togglePhotoSelected(pageNum) {
    setPhotosPreviews(prev =>
      prev.map(p => p.pageNum === pageNum ? { ...p, selected: !p.selected } : p)
    )
  }

  async function uploadPhotos() {
    const selected = photosPreviews.filter(p => p.selected && p.matchedCode)
    if (selected.length === 0) return
    setPhotosUploading(true)
    setPhotosError('')
    let failed = 0
    try {
      for (const preview of selected) {
        // Convertir base64 a Blob
        const res  = await fetch('data:image/jpeg;base64,' + preview.base64)
        const blob = await res.blob()

        // Subir a Storage
        const path = `${orgId}/${preview.matchedCode}_A.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('inventory-photos')
          .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
        if (uploadErr) { console.error('Upload error:', uploadErr); failed++; continue }

        // Obtener URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('inventory-photos')
          .getPublicUrl(path)

        // Actualizar inventory: columna caras con foto
        const caras = JSON.stringify([{
          id:             'A',
          label:          'Cara A',
          photo_url:      publicUrl,
          billboard_zone: null,
        }])
        await supabase
          .from('inventory')
          .update({ caras })
          .eq('code', preview.matchedCode)
          .eq('org_id', orgId)
      }
      setPhotosFailedCount(failed)
      setPhotosUploaded(true)
      await markStepSaved(2)
    } catch (err) {
      setPhotosError(err.message)
    } finally {
      setPhotosUploading(false)
    }
  }

  useEffect(() => {
    if (step === 2 && pdfFile) extractPhotosFromPdf()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pasos 3-5: análisis del archivo del paso 1 ─────────────────────────────

  function applyAnalysisToStep(stepNumber, data) {
    if (stepNumber === 3) setCostsPreview(data)
    if (stepNumber === 4) setAvailPreview(data)
    if (stepNumber === 5) setAudiencePreview(data)
  }

  async function processStep1FileForStep(stepNumber) {
    if (step1Analysis[stepNumber]) {
      applyAnalysisToStep(stepNumber, step1Analysis[stepNumber])
      return
    }
    if (!step1File) return

    const setLoading = { 3: setCostsUploading, 4: setAvailUploading, 5: setAudienceUploading }
    const setError   = { 3: setCostsError,     4: setAvailError,     5: setAudienceError }
    setLoading[stepNumber](true)

    try {
      const XLSXmod = await import('xlsx')
      const XLSX    = XLSXmod.default ?? XLSXmod
      const buffer = await step1File.arrayBuffer()
      const wb     = XLSX.read(buffer, { type: 'array' })

      let sheetsContent = ''
      wb.SheetNames.forEach(name => {
        const csv   = XLSX.utils.sheet_to_csv(wb.Sheets[name])
        const lines = csv.split('\n').slice(0, 50).join('\n')
        sheetsContent += `\n=== HOJA: ${name} ===\n${lines}\n`
      })

      const systemPrompts = { 3: SYSTEM_PROMPT_COSTS, 4: SYSTEM_PROMPT_AVAIL, 5: SYSTEM_PROMPT_AUDIENCE }
      const response = await fetch('/api/claude', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:       'claude-haiku-4-5-20251001',
          max_tokens:  4000,
          temperature: 0,
          system:      systemPrompts[stepNumber],
          messages:    [{ role: 'user', content: sheetsContent }],
        }),
      })

      const data  = await response.json()
      const text  = data.content?.[0]?.text ?? ''
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('La IA no detectó datos relevantes en el archivo')

      const parsed = JSON.parse(match[0])
      setStep1Analysis(prev => ({ ...prev, [stepNumber]: parsed }))
      applyAnalysisToStep(stepNumber, parsed)
    } catch (err) {
      setError[stepNumber](err.message)
    } finally {
      setLoading[stepNumber](false)
    }
  }

  async function handleStepFile(f, stepNumber) {
    if (!f) return
    const setError   = { 3: setCostsError,     4: setAvailError,     5: setAudienceError }
    const setPreview = { 3: setCostsPreview,    4: setAvailPreview,   5: setAudiencePreview }
    const setLoading = { 3: setCostsUploading,  4: setAvailUploading, 5: setAudienceUploading }
    setError[stepNumber]('')
    setPreview[stepNumber]([])
    setLoading[stepNumber](true)
    try {
      const XLSXmod = await import('xlsx')
      const XLSX    = XLSXmod.default ?? XLSXmod
      const buffer = await f.arrayBuffer()
      const wb     = XLSX.read(buffer, { type: 'array' })
      let sheetsContent = ''
      wb.SheetNames.forEach(name => {
        const csv   = XLSX.utils.sheet_to_csv(wb.Sheets[name])
        const lines = csv.split('\n').slice(0, 50).join('\n')
        sheetsContent += `\n=== HOJA: ${name} ===\n${lines}\n`
      })
      const systemPrompts = { 3: SYSTEM_PROMPT_COSTS, 4: SYSTEM_PROMPT_AVAIL, 5: SYSTEM_PROMPT_AUDIENCE }
      const response = await fetch('/api/claude', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 4000, temperature: 0,
          system: systemPrompts[stepNumber],
          messages: [{ role: 'user', content: sheetsContent }],
        }),
      })
      const data  = await response.json()
      const text  = data.content?.[0]?.text ?? ''
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('La IA no detectó datos relevantes en el archivo')
      const parsed = JSON.parse(match[0])
      setStep1Analysis(prev => ({ ...prev, [stepNumber]: parsed }))
      applyAnalysisToStep(stepNumber, parsed)
    } catch (err) {
      setError[stepNumber](err.message)
    } finally {
      setLoading[stepNumber](false)
    }
  }

  async function uploadCosts() {
    if (costsPreview.length === 0) return
    setCostsUploading(true); setCostsError('')
    try {
      const rows = costsPreview.filter(r => r.code).map(r => ({
        org_id: orgId, code: r.code,
        base_rate: r.base_rate ?? null, biweekly_rate: r.biweekly_rate ?? null,
        sale_price: r.sale_price ?? null,
        cost_rent: r.cost_rent ?? null, cost_electricity: r.cost_electricity ?? null,
        cost_taxes: r.cost_taxes ?? null, cost_maintenance: r.cost_maintenance ?? null,
        cost_imponderables: r.cost_imponderables ?? null,
        cost_print_per_m2: r.cost_print_per_m2 ?? null,
        cost_colocation: r.cost_colocation ?? null, cost_design: r.cost_design ?? null,
        cost_seller_commission_pct: r.cost_seller_commission_pct ?? null,
        cost_agency_commission_pct: r.cost_agency_commission_pct ?? null,
        asociado_nombre: r.asociado_nombre ?? null, cost_owner_commission_pct: r.cost_owner_commission_pct ?? null,
      }))
      const { error } = await supabase.from('inventory')
        .upsert(rows, { onConflict: 'org_id,code', ignoreDuplicates: false })
      if (error) throw new Error(error.message)
      setCostsUploaded(true)
      await markStepSaved(3)
    } catch (err) { setCostsError(err.message) }
    finally { setCostsUploading(false) }
  }

  async function uploadAvail() {
    if (availPreview.length === 0) return
    setAvailUploading(true); setAvailError('')
    try {
      const rows = availPreview.filter(r => r.code).map(r => ({
        org_id: orgId, code: r.code,
        is_available:   r.is_available ?? true,
        available_until: r.available_until ?? null,
      }))
      const { error } = await supabase.from('inventory')
        .upsert(rows, { onConflict: 'org_id,code', ignoreDuplicates: false })
      if (error) throw new Error(error.message)
      setAvailUploaded(true)
      await markStepSaved(4)
    } catch (err) { setAvailError(err.message) }
    finally { setAvailUploading(false) }
  }

  async function uploadAudience() {
    if (audiencePreview.length === 0) return
    setAudienceUploading(true); setAudienceError('')
    try {
      const rows = audiencePreview.filter(r => r.code).map(r => ({
        org_id: orgId, code: r.code,
        daily_traffic:     r.daily_traffic ?? null,
        cluster_audiencia: r.cluster_audiencia ?? null,
        audience_source:   r.audience_source ?? 'propio',
      }))
      const { error } = await supabase.from('inventory')
        .upsert(rows, { onConflict: 'org_id,code', ignoreDuplicates: false })
      if (error) throw new Error(error.message)
      setAudienceUploaded(true)
      await markStepSaved(5)
    } catch (err) { setAudienceError(err.message) }
    finally { setAudienceUploading(false) }
  }

  async function downloadMasterTemplate() {
    const XLSXmod = await import('xlsx')
    const XLSX = XLSXmod.default ?? XLSXmod

    const wb = XLSX.utils.book_new()

    // Hoja 1: inventario_carteles
    const inventarioHeaders = [
      'id_cartel *','nombre_ubicacion *','formato *','tipo_propiedad *',
      'direccion *','ciudad *','provincia *','latitud *','longitud *',
      'zona_barrio','ancho_m','alto_m','iluminado','es_digital','es_movil',
      'frecuencia_seg','trafico_diario','cluster_audiencia','fuente_audiencia',
      'activo','disponible_desde','dueno_espacio','precio_mensual_ars *',
      'precio_quincenal_ars','banda_neg_habilitada','banda_neg_precio_ars',
      'banda_neg_meses_min','costo_alquiler_anual','costo_impuestos_anual',
      'costo_derechos_anual','costo_luz_mensual','costo_mant_mensual',
      'costo_imponderable_mensual','costo_dueno_mensual','costo_impresion_m2',
      'costo_colocacion','costo_diseno','comision_vendedor_pct',
      'comision_agencia_pct','comision_dueno_pct','inflacion_ajuste_pct','notas',
    ]
    const wsInventario = XLSX.utils.aoa_to_sheet([inventarioHeaders])
    XLSX.utils.book_append_sheet(wb, wsInventario, 'inventario_carteles')

    // Hoja 2: costos_carteles
    const costosHeaders = [
      'id_cartel *','alquiler_anual_ars','impuestos_anual_ars',
      'derechos_anual_ars','luz_mensual_ars','mant_mensual_ars',
      'imponderable_mensual_ars','dueno_mensual_ars','impresion_por_m2_ars',
      'colocacion_ars','diseno_ars','comision_vendedor_pct',
      'comision_agencia_pct','comision_dueno_pct','inflacion_ajuste_pct',
      'banda_neg_precio_ars','banda_neg_meses_min','notas',
    ]
    const wsCostos = XLSX.utils.aoa_to_sheet([costosHeaders])
    XLSX.utils.book_append_sheet(wb, wsCostos, 'costos_carteles')

    // Hoja 3: clientes
    const clientesHeaders = [
      'razon_social *','cuit','rubro','direccion','ciudad','provincia',
      'contacto_nombre *','contacto_cargo','telefono *','email *',
      'contacto2_nombre','contacto2_telefono','contacto2_email',
      'vendedor_asignado','origen','notas',
    ]
    const wsClientes = XLSX.utils.aoa_to_sheet([clientesHeaders])
    XLSX.utils.book_append_sheet(wb, wsClientes, 'clientes')

    // Hoja 4: formatos_referencia
    const formatosData = [
      ['formato','descripcion','es_digital','es_movil','iluminado_default','ancho_tipico_m','alto_tipico_m','frecuencia_tipica_seg','notas'],
      ['billboard','Espectacular / Columna iluminada','no','no','si',14,8,'',''],
      ['ambient','Top Wall / Medianera','no','no','si',8,12,'',''],
      ['digital','Pantalla LED / DOOH','si','no','si',6,4,8,''],
      ['poster','Afiche / Gigantografía','no','no','no',4,3,'',''],
      ['urban_furniture','Mobiliario Urbano / Parada','no','no','si',1.2,1.8,'',''],
      ['urban_furniture_digital','Mobiliario Urbano Digital','si','no','si',1.2,1.8,8,''],
      ['mobile_screen','Pantalla Móvil / Camión LED','si','si','si',3,2,8,''],
    ]
    const wsFormatos = XLSX.utils.aoa_to_sheet(formatosData)
    XLSX.utils.book_append_sheet(wb, wsFormatos, 'formatos_referencia')

    // Hoja 5: clusters_audiencia
    const clustersHeaders = [
      'nombre_cluster','edad_min','edad_max','genero','nse',
      'intereses','zona_principal','fuente','activo',
    ]
    const wsClusters = XLSX.utils.aoa_to_sheet([clustersHeaders])
    XLSX.utils.book_append_sheet(wb, wsClusters, 'clusters_audiencia')

    XLSX.writeFile(wb, 'OOH_Planner_Plantilla_Inventario.xlsx')
  }

  async function downloadCostsTemplate() {
    const XLSXmod = await import('xlsx')
    const XLSX = XLSXmod.default ?? XLSXmod
    const headers = ['codigo','nombre','direccion','precio_mensual','precio_venta',
      'costo_alquiler','costo_luz','costo_impuestos','costo_mantenimiento',
      'costo_imponderables','costo_impresion_m2','costo_colocacion','costo_diseno',
      'comision_vendedor_pct','comision_agencia_pct','asociado_nombre','cost_owner_commission_pct']
    const rows = importedItems.map(i => [i.code, i.name, i.address, '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Costos')
    XLSX.writeFile(wb, 'plantilla_costos_oohplanner.xlsx')
  }

  useEffect(() => {
    if (step === 3 && step1File) processStep1FileForStep(3)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === 4 && step1File) processStep1FileForStep(4)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === 5 && step1File) processStep1FileForStep(5)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Footer: lógica del botón Siguiente ─────────────────────────────────────

  const pendingImport   = step === 1 && items.length > 0 && importedCount === null
  const pendingPhotos   = step === 2 && photosPreviews.length > 0 && !photosUploaded
  const pendingCosts    = step === 3 && costsPreview.length > 0 && !costsUploaded
  const pendingAvail    = step === 4 && availPreview.length > 0 && !availUploaded
  const pendingAudience = step === 5 && audiencePreview.length > 0 && !audienceUploaded

  const nextLabel = step === STEPS.length
    ? 'Finalizar'
    : pendingImport
      ? 'Importar y continuar'
      : pendingPhotos
        ? 'Subir fotos y continuar'
        : pendingCosts
          ? 'Confirmar costos y continuar'
          : pendingAvail
            ? 'Confirmar disponibilidad y continuar'
            : pendingAudience
              ? 'Confirmar audiencias y continuar'
              : 'Siguiente'

  async function handleNext() {
    if (pendingImport) {
      const count = await handleImport()
      if (count !== null) setStep(s => s + 1)
    } else if (pendingPhotos) {
      await uploadPhotos()
      setStep(s => s + 1)
    } else if (pendingCosts) {
      await uploadCosts()
      setStep(s => s + 1)
    } else if (pendingAvail) {
      await uploadAvail()
      setStep(s => s + 1)
    } else if (pendingAudience) {
      await uploadAudience()
      setStep(s => s + 1)
    } else if (step === STEPS.length) {
      onComplete?.()
    } else {
      setStep(s => s + 1)
    }
  }

  // ── Contadores ──────────────────────────────────────────────────────────────

  const okCount      = items.filter(i => rowStatus(i) === 'ok').length
  const warningCount = items.filter(i => rowStatus(i) === 'warning').length
  const errorCount   = items.filter(i => rowStatus(i) === 'error').length

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-900 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-surface-700 bg-surface-800">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white">Asistente de carga inicial</h2>
            <p className="text-xs text-slate-500">
              Paso {step} de {STEPS.length} — {STEPS[step - 1].label}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-surface-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Barra de progreso con pasos */}
        <div className="mx-auto max-w-4xl px-6 pb-4">
          <div className="flex items-center">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-1.5 text-xs whitespace-nowrap transition-colors ${
                    step === s.id
                      ? 'text-brand'
                      : savedSteps.has(s.id)
                      ? 'text-teal-400'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                    step === s.id
                      ? 'border-brand bg-brand/10 text-brand'
                      : savedSteps.has(s.id)
                      ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                      : 'border-slate-700 text-slate-600'
                  }`}>
                    {savedSteps.has(s.id) ? '✓' : s.id}
                  </span>
                  <span className="hidden sm:block">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 mx-1.5 h-px transition-colors ${
                    savedSteps.has(s.id) ? 'bg-teal-500/40' : 'bg-surface-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-6 space-y-5">

          {/* ──── PASO 1: Ubicaciones ──── */}
          {step === 1 && (
            <>
              {/* Estado: importación exitosa */}
              {importedCount !== null && (
                <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-10 text-center space-y-3">
                  <CheckCircle className="mx-auto h-12 w-12 text-teal-400" />
                  <h3 className="text-lg font-semibold text-white">
                    ¡{importedCount} cartel{importedCount !== 1 ? 'es' : ''} importado{importedCount !== 1 ? 's' : ''}!
                  </h3>
                  <p className="text-sm text-slate-400">
                    Tu inventario base está cargado. Podés continuar con los siguientes pasos.
                  </p>
                </div>
              )}

              {/* Estado: tabla editable (archivo parseado) */}
              {importedCount === null && items.length > 0 && (
                <div className="space-y-4">
                  {/* Encabezado tabla */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {items.length} cartel{items.length !== 1 ? 'es' : ''} detectado{items.length !== 1 ? 's' : ''}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                        {okCount > 0 && (
                          <span className="flex items-center gap-1.5 text-xs text-teal-400">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-teal-400" />
                            {okCount} completo{okCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {warningCount > 0 && (
                          <span className="flex items-center gap-1.5 text-xs text-amber-400">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                            {warningCount} sin dirección
                          </span>
                        )}
                        {errorCount > 0 && (
                          <span className="flex items-center gap-1.5 text-xs text-red-400">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
                            {errorCount} con error (serán omitidos)
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setFile(null); setItems([]); setParseError('') }}
                      className="shrink-0 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Cambiar archivo
                    </button>
                  </div>

                  {parseError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                      {parseError}
                    </div>
                  )}

                  {/* Tabla */}
                  <div className="overflow-x-auto rounded-xl border border-surface-700">
                    <table className="w-full min-w-[680px] text-xs">
                      <thead>
                        <tr className="border-b border-surface-700 bg-surface-800">
                          <th className="w-6 px-2 py-2" />
                          <th className="px-2 py-2 text-left font-medium text-slate-500 min-w-[72px]">Código</th>
                          <th className="px-2 py-2 text-left font-medium text-slate-500 min-w-[150px]">Nombre</th>
                          <th className="px-2 py-2 text-left font-medium text-slate-500 min-w-[170px]">Dirección</th>
                          <th className="px-2 py-2 text-left font-medium text-slate-500 min-w-[130px]">Formato</th>
                          <th className="px-2 py-2 text-left font-medium text-slate-500 w-14">Caras</th>
                          <th className="px-2 py-2 text-center font-medium text-slate-500 w-18">Ilum.</th>
                          <th className="px-2 py-2 text-left font-medium text-slate-500 min-w-[90px]">Precio/mes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => {
                          const st = rowStatus(item)
                          return (
                            <tr
                              key={idx}
                              className={`border-b border-surface-700/40 ${
                                idx % 2 === 0 ? 'bg-surface-900' : 'bg-surface-800/20'
                              }`}
                            >
                              {/* Semáforo */}
                              <td className="px-2 py-1.5 text-center">
                                <span className={`inline-block h-2 w-2 rounded-full ${
                                  st === 'ok'      ? 'bg-teal-400' :
                                  st === 'warning' ? 'bg-amber-400'   : 'bg-red-400'
                                }`} />
                              </td>

                              {/* Código */}
                              <td className="px-1 py-1">
                                <input
                                  className="w-full rounded bg-transparent px-1 py-0.5 text-slate-300 outline-none focus:bg-surface-700 focus:ring-1 focus:ring-brand/40"
                                  value={item.code}
                                  onChange={e => updateItem(idx, 'code', e.target.value)}
                                />
                              </td>

                              {/* Nombre */}
                              <td className="px-1 py-1">
                                <input
                                  className="w-full rounded bg-transparent px-1 py-0.5 text-slate-300 outline-none focus:bg-surface-700 focus:ring-1 focus:ring-brand/40"
                                  value={item.name}
                                  onChange={e => updateItem(idx, 'name', e.target.value)}
                                />
                              </td>

                              {/* Dirección */}
                              <td className="px-1 py-1">
                                <input
                                  className="w-full rounded bg-transparent px-1 py-0.5 text-slate-300 outline-none focus:bg-surface-700 focus:ring-1 focus:ring-brand/40"
                                  value={item.address}
                                  onChange={e => updateItem(idx, 'address', e.target.value)}
                                />
                              </td>

                              {/* Formato */}
                              <td className="px-1 py-1">
                                <select
                                  className="w-full rounded border border-transparent bg-surface-800 px-1 py-0.5 text-xs text-slate-300 outline-none focus:border-brand/40"
                                  value={item.format}
                                  onChange={e => updateItem(idx, 'format', e.target.value)}
                                >
                                  {FORMAT_OPTIONS.map(f => (
                                    <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Caras */}
                              <td className="px-1 py-1">
                                <input
                                  type="number"
                                  min="1"
                                  className="w-full rounded bg-transparent px-1 py-0.5 text-slate-300 outline-none focus:bg-surface-700 focus:ring-1 focus:ring-brand/40"
                                  value={item.faces_count ?? 1}
                                  onChange={e => updateItem(idx, 'faces_count', Math.max(1, Number(e.target.value)))}
                                />
                              </td>

                              {/* Iluminado */}
                              <td className="px-1 py-1 text-center">
                                <input
                                  type="checkbox"
                                  checked={item.illuminated}
                                  onChange={e => updateItem(idx, 'illuminated', e.target.checked)}
                                  className="accent-brand"
                                />
                              </td>

                              {/* Precio base */}
                              <td className="px-1 py-1">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="ARS"
                                  className="w-full rounded bg-transparent px-1 py-0.5 text-slate-300 placeholder-slate-700 outline-none focus:bg-surface-700 focus:ring-1 focus:ring-brand/40"
                                  value={item.base_rate ?? ''}
                                  onChange={e => updateItem(idx, 'base_rate', e.target.value === '' ? null : Number(e.target.value))}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

              {/* Estado: zona de carga de archivo */}
              {importedCount === null && items.length === 0 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">
                      Subí tu base de ubicaciones
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Aceptamos Excel (.xlsx .xls), CSV, OpenDocument (.ods), Word (.docx), PDF o imagen. La IA detecta las columnas automáticamente sin importar cómo las hayas nombrado.
                      los mapeamos automáticamente. Para PDF e imágenes usamos IA para extraer la información.
                    </p>
                  </div>

                  {/* Plantilla maestra */}
                  <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">¿No tenés tu data lista?</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Descargá nuestra plantilla Excel completa, completala con tus carteles y subila acá.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={downloadMasterTemplate}
                        className="flex items-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-xs font-medium text-brand hover:bg-brand/20 transition-colors shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Descargar plantilla
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="flex items-center gap-1">📋 Ubicaciones</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">💰 Costos</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">👥 Clientes</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">📊 Audiencias</span>
                    </div>
                  </div>

                  {parseError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                      {parseError}
                    </div>
                  )}

                  {/* Drop zone */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer rounded-2xl border-2 border-dashed border-surface-600 bg-surface-800/50 p-12 text-center hover:border-brand/40 hover:bg-surface-800 transition-colors select-none"
                  >
                    {parsing ? (
                      <div className="space-y-3">
                        <Loader2 className="mx-auto h-10 w-10 text-brand animate-spin" />
                        <p className="text-sm text-slate-400">
                          {parseProgress || 'Procesando archivo…'}
                        </p>
                        {parseProgress && (
                          <p className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <Sparkles className="h-3 w-3" /> Analizando con IA
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="mx-auto h-10 w-10 text-slate-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-300">
                            Arrastrá tu archivo aquí o hacé clic para seleccionar
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Excel · CSV · PDF · JPG · PNG
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Excel / CSV → parseo automático
                          </span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> PDF / Imagen → IA
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.ods,.docx,.pdf,image/*"
                    className="hidden"
                    onChange={handleFileInput}
                  />

                  {/* Leyenda semáforo */}
                  <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4 space-y-2.5">
                    <p className="text-xs font-medium text-slate-400">Semáforo de validación por fila</p>
                    <div className="space-y-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-teal-400" />
                        Verde — tiene código, nombre y dirección
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                        Amarillo — falta dirección u otros campos opcionales
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
                        Rojo — falta código o nombre (no se importará)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ──── PASO 2: Imágenes ──── */}
          {step === 2 && (
            <>
              {/* Extrayendo fotos */}
              {photosExtracting && (
                <div className="flex flex-col items-center justify-center py-20 space-y-5">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 text-brand animate-spin" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-white">Extrayendo fotos del PDF...</p>
                    <p className="text-xs text-slate-500">{parseProgress || 'Procesando páginas, esto puede tardar unos segundos'}</p>
                  </div>
                  <div className="w-64 rounded-full bg-surface-700 h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full bg-brand animate-pulse w-full" />
                  </div>
                  <p className="text-xs text-slate-600">No cerrés esta ventana</p>
                </div>
              )}

              {photosUploading && (
                <div className="flex flex-col items-center justify-center py-20 space-y-5">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 text-brand animate-spin" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-white">Subiendo fotos al inventario...</p>
                    <p className="text-xs text-slate-500">Esto puede tardar unos segundos</p>
                  </div>
                  <div className="w-64 rounded-full bg-surface-700 h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full bg-brand animate-pulse w-full" />
                  </div>
                  <p className="text-xs text-slate-600">No cerrés esta ventana</p>
                </div>
              )}

              {/* Subida exitosa */}
              {photosUploaded && (
                <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-10 text-center space-y-3">
                  <CheckCircle className="mx-auto h-12 w-12 text-teal-400" />
                  <h3 className="text-lg font-semibold text-white">¡Fotos subidas al inventario!</h3>
                  <p className="text-sm text-slate-400">Las imágenes ya están asociadas a cada cartel.</p>
                </div>
              )}

              {/* Error */}
              {photosError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {photosError}
                </div>
              )}

              {/* Grilla de fotos extraídas del PDF */}
              {!photosExtracting && !photosUploading && !photosUploaded && photosPreviews.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {photosPreviews.length} página{photosPreviews.length !== 1 ? 's' : ''} extraída{photosPreviews.length !== 1 ? 's' : ''} del PDF
                    </h3>
                  </div>

                  <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 flex gap-3">
                    <span className="text-brand text-lg shrink-0">💡</span>
                    <div className="text-xs text-slate-400 leading-relaxed">
                      <span className="font-semibold text-slate-300">
                        Estas imágenes son capturas de tu PDF — ideales para identificar cada cartel.
                      </span>
                      {' '}Más adelante, desde el <span className="text-brand font-medium">Editor de Zonas</span> vas a poder:
                      <ul className="mt-1.5 space-y-0.5 list-disc list-inside text-slate-500">
                        <li>Reemplazar cada imagen por una foto original de mayor calidad</li>
                        <li>Marcar la superficie del cartel (4 puntos) para generar mockups en las propuestas</li>
                      </ul>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photosPreviews.map(preview => (
                      <div
                        key={preview.pageNum}
                        onClick={() => togglePhotoSelected(preview.pageNum)}
                        className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-colors ${
                          preview.selected
                            ? 'border-brand ring-1 ring-brand/30'
                            : 'border-surface-700 opacity-60'
                        }`}
                      >
                        <img
                          src={`data:image/jpeg;base64,${preview.base64}`}
                          alt={`Página ${preview.pageNum}`}
                          className="w-full aspect-video object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-surface-900/80 px-2 py-1.5 space-y-0.5">
                          {preview.matchedCode ? (
                            <>
                              <p className="text-[10px] font-mono text-brand leading-tight">{preview.matchedCode}</p>
                              <p className="text-[10px] text-slate-300 leading-tight truncate">{preview.matchedName}</p>
                            </>
                          ) : (
                            <p className="text-[10px] text-amber-400">Sin match — pág. {preview.pageNum}</p>
                          )}
                        </div>
                        <div className={`absolute top-2 right-2 h-4 w-4 rounded border-2 flex items-center justify-center ${
                          preview.selected
                            ? 'border-brand bg-brand'
                            : 'border-slate-500 bg-surface-800/70'
                        }`}>
                          {preview.selected && <CheckCircle className="h-2.5 w-2.5 text-white" />}
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              )}

              {/* Sin PDF: dropzone para ZIP */}
              {!photosExtracting && !photosUploading && !photosUploaded && photosPreviews.length === 0 && !pdfFile && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Subí las fotos de tus carteles</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      No se detectó un PDF en el paso anterior. Podés usar el botón <strong className="text-slate-400">"Subir fotos"</strong> desde la pantalla de inventario para subir un ZIP con las imágenes.
                    </p>
                  </div>
                  <div className="rounded-2xl border-2 border-dashed border-surface-600 bg-surface-800/50 p-12 text-center space-y-3">
                    <Image className="mx-auto h-10 w-10 text-slate-600" />
                    <p className="text-sm text-slate-500">
                      Volvé al Paso 1 y subí tu inventario en formato PDF para extraer las fotos automáticamente.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ──── PASO 3: Costos y tarifas ──── */}
          {step === 3 && (
            <>
              {costsUploading && (
                <div className="flex flex-col items-center justify-center py-20 space-y-5">
                  <Loader2 className="h-12 w-12 text-brand animate-spin" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {costsPreview.length === 0 ? 'Analizando tarifas con IA…' : 'Guardando costos…'}
                    </p>
                    <p className="text-xs text-slate-500">No cerrés esta ventana</p>
                  </div>
                </div>
              )}

              {costsUploaded && (
                <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-10 text-center space-y-3">
                  <CheckCircle className="mx-auto h-12 w-12 text-teal-400" />
                  <h3 className="text-lg font-semibold text-white">¡Costos actualizados!</h3>
                  <p className="text-sm text-slate-400">Las tarifas ya están guardadas en tu inventario.</p>
                </div>
              )}

              {costsError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {costsError}
                </div>
              )}

              {!costsUploading && !costsUploaded && costsPreview.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">
                      {costsPreview.length} cartel{costsPreview.length !== 1 ? 'es' : ''} con datos de costos
                    </h3>
                    <span className="flex items-center gap-1.5 text-xs text-brand">
                      <Sparkles className="h-3 w-3" /> Detectado con IA
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-surface-700">
                    <table className="w-full min-w-[560px] text-xs">
                      <thead>
                        <tr className="border-b border-surface-700 bg-surface-800">
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Código</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-500">Tarifa mensual</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-500">Precio venta</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-500">Alquiler</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-500">Com. vendedor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costsPreview.map((r, i) => (
                          <tr key={i} className={`border-b border-surface-700/40 ${i % 2 === 0 ? 'bg-surface-900' : 'bg-surface-800/20'}`}>
                            <td className="px-3 py-1.5 font-mono text-slate-300">{r.code}</td>
                            <td className="px-3 py-1.5 text-right text-slate-300">{fmtARS(r.base_rate)}</td>
                            <td className="px-3 py-1.5 text-right text-slate-300">{fmtARS(r.sale_price)}</td>
                            <td className="px-3 py-1.5 text-right text-slate-300">{fmtARS(r.cost_rent)}</td>
                            <td className="px-3 py-1.5 text-right text-slate-300">{fmtPct(r.cost_seller_commission_pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!costsUploading && !costsUploaded && costsPreview.length === 0 && !costsError && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Costos y tarifas</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {step1File
                        ? 'No se detectaron datos de costos en tu archivo. Podés subir una planilla específica de tarifas.'
                        : 'Subí una planilla con las tarifas de tus carteles para actualizarlas automáticamente.'}
                    </p>
                  </div>
                  <button
                    onClick={downloadCostsTemplate}
                    className="flex items-center gap-1.5 text-xs text-brand hover:text-brand/80 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" /> Descargar plantilla de costos
                  </button>
                </div>
              )}

              {!costsUploading && !costsUploaded && (
                <>
                  <div
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleStepFile(f, 3) }}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => fileInputSRef.current?.click()}
                    className="cursor-pointer rounded-xl border-2 border-dashed border-surface-600 bg-surface-800/30 px-6 py-6 text-center hover:border-brand/40 hover:bg-surface-800/50 transition-colors"
                  >
                    <Upload className="mx-auto h-6 w-6 text-slate-600 mb-2" />
                    <p className="text-xs text-slate-500">
                      {step1File ? 'Subí otra planilla si tenés los costos en un archivo separado' : 'Arrastrá una planilla Excel / CSV'}
                    </p>
                  </div>
                  <input
                    ref={fileInputSRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleStepFile(f, 3); e.target.value = '' }}
                  />
                </>
              )}

              <p className="text-xs text-slate-600 text-center">
                💡 Podés saltear este paso y completar los costos más tarde desde la sección Inventario.
              </p>
            </>
          )}

          {/* ──── PASO 4: Disponibilidad ──── */}
          {step === 4 && (
            <>
              {availUploading && (
                <div className="flex flex-col items-center justify-center py-20 space-y-5">
                  <Loader2 className="h-12 w-12 text-brand animate-spin" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {availPreview.length === 0 ? 'Analizando disponibilidad con IA…' : 'Guardando disponibilidad…'}
                    </p>
                    <p className="text-xs text-slate-500">No cerrés esta ventana</p>
                  </div>
                </div>
              )}

              {availUploaded && (
                <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-10 text-center space-y-3">
                  <CheckCircle className="mx-auto h-12 w-12 text-teal-400" />
                  <h3 className="text-lg font-semibold text-white">¡Disponibilidad actualizada!</h3>
                  <p className="text-sm text-slate-400">El estado de ocupación ya está guardado.</p>
                </div>
              )}

              {availError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {availError}
                </div>
              )}

              {!availUploading && !availUploaded && availPreview.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">
                      {availPreview.length} cartel{availPreview.length !== 1 ? 'es' : ''} con datos de disponibilidad
                    </h3>
                    <span className="flex items-center gap-1.5 text-xs text-brand">
                      <Sparkles className="h-3 w-3" /> Detectado con IA
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-surface-700">
                    <table className="w-full min-w-[400px] text-xs">
                      <thead>
                        <tr className="border-b border-surface-700 bg-surface-800">
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Código</th>
                          <th className="px-3 py-2 text-center font-medium text-slate-500">Estado</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Disponible hasta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availPreview.map((r, i) => (
                          <tr key={i} className={`border-b border-surface-700/40 ${i % 2 === 0 ? 'bg-surface-900' : 'bg-surface-800/20'}`}>
                            <td className="px-3 py-1.5 font-mono text-slate-300">{r.code}</td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                r.is_available
                                  ? 'bg-teal-500/15 text-teal-400'
                                  : 'bg-red-500/15 text-red-400'
                              }`}>
                                {r.is_available ? 'Disponible' : 'Ocupado'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-slate-400">{r.available_until ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!availUploading && !availUploaded && availPreview.length === 0 && !availError && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Disponibilidad u ocupación</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {step1File
                      ? 'No se detectaron datos de disponibilidad en tu archivo. Podés subir una planilla específica.'
                      : 'Subí una planilla con el estado de ocupación de tus carteles.'}
                  </p>
                </div>
              )}

              {!availUploading && !availUploaded && (
                <>
                  <div
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleStepFile(f, 4) }}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => fileInputSRef.current?.click()}
                    className="cursor-pointer rounded-xl border-2 border-dashed border-surface-600 bg-surface-800/30 px-6 py-6 text-center hover:border-brand/40 hover:bg-surface-800/50 transition-colors"
                  >
                    <Upload className="mx-auto h-6 w-6 text-slate-600 mb-2" />
                    <p className="text-xs text-slate-500">
                      {step1File ? 'Subí otra planilla con el estado de ocupación' : 'Arrastrá una planilla Excel / CSV'}
                    </p>
                  </div>
                  <input
                    ref={fileInputSRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleStepFile(f, 4); e.target.value = '' }}
                  />
                </>
              )}

              <p className="text-xs text-slate-600 text-center">
                💡 Podés saltear este paso y actualizar la disponibilidad más tarde desde la sección Inventario.
              </p>
            </>
          )}

          {/* ──── PASO 5: Audiencias ──── */}
          {step === 5 && (
            <>
              {audienceUploading && (
                <div className="flex flex-col items-center justify-center py-20 space-y-5">
                  <Loader2 className="h-12 w-12 text-brand animate-spin" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {audiencePreview.length === 0 ? 'Analizando audiencias con IA…' : 'Guardando datos de audiencia…'}
                    </p>
                    <p className="text-xs text-slate-500">No cerrés esta ventana</p>
                  </div>
                </div>
              )}

              {audienceUploaded && (
                <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-10 text-center space-y-3">
                  <CheckCircle className="mx-auto h-12 w-12 text-teal-400" />
                  <h3 className="text-lg font-semibold text-white">¡Audiencias actualizadas!</h3>
                  <p className="text-sm text-slate-400">Los datos de tráfico ya están guardados en tu inventario.</p>
                </div>
              )}

              {audienceError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {audienceError}
                </div>
              )}

              {!audienceUploading && !audienceUploaded && audiencePreview.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">
                      {audiencePreview.length} cartel{audiencePreview.length !== 1 ? 'es' : ''} con datos de audiencia
                    </h3>
                    <span className="flex items-center gap-1.5 text-xs text-brand">
                      <Sparkles className="h-3 w-3" /> Detectado con IA
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-surface-700">
                    <table className="w-full min-w-[480px] text-xs">
                      <thead>
                        <tr className="border-b border-surface-700 bg-surface-800">
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Código</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-500">Tráfico diario</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Segmento</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Fuente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audiencePreview.map((r, i) => (
                          <tr key={i} className={`border-b border-surface-700/40 ${i % 2 === 0 ? 'bg-surface-900' : 'bg-surface-800/20'}`}>
                            <td className="px-3 py-1.5 font-mono text-slate-300">{r.code}</td>
                            <td className="px-3 py-1.5 text-right text-slate-300">{fmtNum(r.daily_traffic)}</td>
                            <td className="px-3 py-1.5 text-slate-400">{r.cluster_audiencia ?? '—'}</td>
                            <td className="px-3 py-1.5 text-slate-500">{r.audience_source ?? 'propio'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!audienceUploading && !audienceUploaded && audiencePreview.length === 0 && !audienceError && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Tráfico e impactos</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {step1File
                      ? 'No se detectaron datos de audiencia en tu archivo. Podés subir una planilla específica.'
                      : 'Subí una planilla con el tráfico o impactos de tus carteles.'}
                  </p>
                </div>
              )}

              {!audienceUploading && !audienceUploaded && (
                <>
                  <div
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleStepFile(f, 5) }}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => fileInputSRef.current?.click()}
                    className="cursor-pointer rounded-xl border-2 border-dashed border-surface-600 bg-surface-800/30 px-6 py-6 text-center hover:border-brand/40 hover:bg-surface-800/50 transition-colors"
                  >
                    <Upload className="mx-auto h-6 w-6 text-slate-600 mb-2" />
                    <p className="text-xs text-slate-500">
                      {step1File ? 'Subí otra planilla con datos de tráfico o audiencia' : 'Arrastrá una planilla Excel / CSV'}
                    </p>
                  </div>
                  <input
                    ref={fileInputSRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleStepFile(f, 5); e.target.value = '' }}
                  />
                </>
              )}

              <p className="text-xs text-slate-600 text-center">
                💡 Podés saltear este paso y cargar los datos de audiencia más tarde desde la sección Inventario.
              </p>
            </>
          )}

          {/* ──── PASO 6: Resumen ──── */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-6 text-center space-y-2">
                <CheckCircle className="h-10 w-10 text-teal-400 mx-auto" />
                <p className="text-base font-semibold text-white">¡Inventario cargado!</p>
                <p className="text-sm text-slate-400">Tu inventario base está listo para usar el planificador.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4 text-center">
                  <p className="text-2xl font-bold text-white">{importedCount ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">Carteles importados</p>
                </div>
                <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4 text-center">
                  <p className="text-2xl font-bold text-white">
                    {photosPreviews.filter(p => p.selected && p.matchedCode).length - photosFailedCount}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Fotos asociadas</p>
                </div>
              </div>

              {photosFailedCount > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex gap-3">
                  <span className="text-amber-400 text-lg shrink-0">⚠️</span>
                  <div className="text-xs text-slate-400 leading-relaxed">
                    <span className="font-semibold text-amber-400">{photosFailedCount} foto{photosFailedCount !== 1 ? 's' : ''} no pudieron asociarse.</span>
                    {' '}Podés cargarlas manualmente desde el{' '}
                    <span className="text-brand font-medium">Editor de Zonas</span>
                    {' '}— también vas a poder marcar la superficie del cartel para generar mockups.
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-3 flex gap-3">
                <span className="text-brand text-lg shrink-0">💡</span>
                <div className="text-xs text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-300">Próximos pasos recomendados:</span>
                  <ul className="mt-1.5 space-y-1 list-disc list-inside text-slate-500">
                    <li>Completar costos desde la sección Inventario</li>
                    <li>Marcar zonas de anuncio en el Editor de Zonas</li>
                    <li>Crear tu primera propuesta con el Planificador IA</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-surface-700 bg-surface-800">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={step === 1}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-surface-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>

          <span className="text-xs text-slate-600">{step} / {STEPS.length}</span>

          <button
            onClick={handleNext}
            disabled={importing || costsUploading || availUploading || audienceUploading}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {(importing || costsUploading || availUploading || audienceUploading)
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando…</>
              : <>{nextLabel}{step < STEPS.length && <ChevronRight className="h-4 w-4" />}</>
            }
          </button>
        </div>
      </div>

    </div>
  )
}
