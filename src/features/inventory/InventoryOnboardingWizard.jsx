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
  Loader2, Clock, Sparkles, FileText, Image, AlertCircle,
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
  'urban_furniture', 'urban_furniture_digital', 'mobile_screen',
]

const FORMAT_LABELS = {
  billboard:              'Espectacular',
  digital:                'Digital / LED',
  ambient:                'Medianera / Top Wall',
  poster:                 'Afiche',
  urban_furniture:        'Mobiliario Urbano',
  urban_furniture_digital:'Mobiliario Digital',
  mobile_screen:          'Pantalla Móvil',
}

// ── Mapeo de nombres coloquiales a valores del schema ─────────────────────────

const FORMAT_KEYWORD_MAP = {
  'espectacular': 'billboard', 'columna': 'billboard', 'cartel': 'billboard', 'valla': 'billboard',
  'top wall': 'ambient', 'medianera': 'ambient', 'fachada': 'ambient', 'ambient': 'ambient',
  'digital': 'digital', 'led': 'digital', 'dooh': 'digital', 'pantalla': 'digital',
  'afiche': 'poster', 'poster': 'poster', 'gigantografía': 'poster', 'gigantografia': 'poster',
  'mobiliario': 'urban_furniture', 'urban_furniture': 'urban_furniture',
  'parada': 'urban_furniture', 'kiosco': 'urban_furniture',
  'mobile_screen': 'mobile_screen', 'móvil': 'mobile_screen', 'movil': 'mobile_screen',
  'urban_furniture_digital': 'urban_furniture_digital',
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
  width_m:   ['ancho','width','ancho_m','ancho (m)','ancho m','width_m'],
  height_m:  ['alto','height','alto_m','alto (m)','alto m','altura','height_m'],
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
- format: "billboard" (espectacular/columna/cartel/valla) | "ambient" (top wall/medianera/fachada) | "digital" (LED/DOOH/pantalla) | "poster" (afiche/gigantografía) | "urban_furniture" (mobiliario/parada/kiosco) | "mobile_screen"
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
  const XLSX = (await import('xlsx')).default
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  return rows.map(row => normalizeRow(mapHeaders(row)))
}

async function parseCsv(file) {
  const Papa = (await import('papaparse')).default
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: r => resolve(r.data.map(row => normalizeRow(mapHeaders(row)))),
      error:    reject,
    })
  })
}

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

  // Step 2
  const [photosPreviews,   setPhotosPreviews]   = useState([])
  const [photosExtracting, setPhotosExtracting] = useState(false)
  const [photosUploading,  setPhotosUploading]  = useState(false)
  const [photosUploaded,   setPhotosUploaded]   = useState(false)
  const [photosError,      setPhotosError]      = useState('')

  const fileInputRef = useRef(null)
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

      if (ext === 'xlsx' || ext === 'xls') {
        parsed = await parseSpreadsheet(f)
      } else if (ext === 'csv') {
        parsed = await parseCsv(f)
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
        if (uploadErr) { console.error('Upload error:', uploadErr); continue }

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

  // ── Footer: lógica del botón Siguiente ─────────────────────────────────────

  const pendingImport = step === 1 && items.length > 0 && importedCount === null
  const pendingPhotos = step === 2 && photosPreviews.length > 0 && !photosUploaded

  const nextLabel = step === STEPS.length
    ? 'Finalizar'
    : pendingImport
      ? 'Importar y continuar'
      : pendingPhotos
        ? 'Subir fotos y continuar'
        : 'Siguiente'

  async function handleNext() {
    if (pendingImport) {
      const count = await handleImport()
      if (count !== null) setStep(s => s + 1)
    } else if (pendingPhotos) {
      await uploadPhotos()
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
                      ? 'text-emerald-400'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                    step === s.id
                      ? 'border-brand bg-brand/10 text-brand'
                      : savedSteps.has(s.id)
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-slate-700 text-slate-600'
                  }`}>
                    {savedSteps.has(s.id) ? '✓' : s.id}
                  </span>
                  <span className="hidden sm:block">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 mx-1.5 h-px transition-colors ${
                    savedSteps.has(s.id) ? 'bg-emerald-500/40' : 'bg-surface-700'
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
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-10 text-center space-y-3">
                  <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
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
                          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
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
                                  st === 'ok'      ? 'bg-emerald-400' :
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
                      Aceptamos Excel (.xlsx), CSV, PDF o imagen. Si tu planilla tiene encabezados en español o inglés
                      los mapeamos automáticamente. Para PDF e imágenes usamos IA para extraer la información.
                    </p>
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
                    accept=".xlsx,.xls,.csv,.pdf,image/*"
                    className="hidden"
                    onChange={handleFileInput}
                  />

                  {/* Leyenda semáforo */}
                  <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4 space-y-2.5">
                    <p className="text-xs font-medium text-slate-400">Semáforo de validación por fila</p>
                    <div className="space-y-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
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
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-10 text-center space-y-3">
                  <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
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

          {/* ──── PASOS 3–6: Placeholder ──── */}
          {step > 2 && (
            <div className="rounded-2xl border border-surface-700 bg-surface-800/50 p-14 text-center space-y-4">
              <Clock className="mx-auto h-12 w-12 text-slate-700" />
              <div>
                <h3 className="text-base font-semibold text-white">{STEPS[step - 1].label}</h3>
                <p className="mt-1 text-sm text-slate-500">{STEPS[step - 1].desc}</p>
                <p className="mt-2 text-xs text-slate-600">Esta sección estará disponible próximamente.</p>
              </div>
              <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
                Próximamente
              </span>
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
            disabled={importing}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {importing
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando…</>
              : <>{nextLabel}{step < STEPS.length && <ChevronRight className="h-4 w-4" />}</>
            }
          </button>
        </div>
      </div>

    </div>
  )
}
