/**
 * InventoryOnboardingWizard
 * Modal full-screen de 6 pasos para carga inicial de inventario.
 *
 * MIGRACIÓN REQUERIDA — ejecutar en Supabase SQL Editor:
 *   ALTER TABLE organisations ADD COLUMN IF NOT EXISTS onboarding_step int DEFAULT 0;
 */

import { useState, useRef } from 'react'
import {
  X, Upload, CheckCircle, ChevronLeft, ChevronRight,
  Loader2, Clock, Sparkles, FileText,
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

async function callClaudeWithFile(file) {
  const base64 = await fileToBase64(file)
  const isPdf   = file.type === 'application/pdf'

  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image',    source: { type: 'base64', media_type: file.type, data: base64 } }

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system:     CLAUDE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: 'Extraé todos los carteles/ubicaciones y devolvé el array JSON.' },
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
  const { orgId } = useAuth()
  const [step,       setStep]       = useState(1)
  const [savedSteps, setSavedSteps] = useState(new Set())

  // Step 1 state
  const [file,         setFile]         = useState(null)
  const [parsing,      setParsing]      = useState(false)
  const [parseError,   setParseError]   = useState('')
  const [items,        setItems]        = useState([])
  const [importing,    setImporting]    = useState(false)
  const [importedCount,setImportedCount]= useState(null)

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
      } else {
        // PDF o imagen → Claude
        const raw = await callClaudeWithFile(f)
        parsed = Array.isArray(raw) ? raw.map(r => normalizeRow(r)) : []
      }

      if (parsed.length === 0) throw new Error('No se encontraron carteles en el archivo')
      setItems(parsed)
    } catch (err) {
      setParseError(err.message)
      setFile(null)
    } finally {
      setParsing(false)
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
      const valid = items.filter(i => i.code && i.name)
      if (valid.length === 0) throw new Error('No hay carteles con código y nombre completos para importar')

      const rows = valid.map(item => toDbPayload(item, orgId))
      const { error } = await supabase.from('inventory').insert(rows)
      if (error) throw new Error(error.message)

      setImportedCount(valid.length)
      await markStepSaved(1)
      return valid.length
    } catch (err) {
      setParseError(err.message)
      return null
    } finally {
      setImporting(false)
    }
  }

  // ── Footer: lógica del botón Siguiente ─────────────────────────────────────

  const pendingImport = step === 1 && items.length > 0 && importedCount === null
  const nextLabel = step === STEPS.length
    ? 'Finalizar'
    : pendingImport
    ? 'Importar y continuar'
    : 'Siguiente'

  async function handleNext() {
    if (pendingImport) {
      const count = await handleImport()
      if (count !== null) setStep(s => s + 1)
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

                  {/* Botón importar */}
                  <button
                    onClick={handleImport}
                    disabled={importing || (okCount + warningCount) === 0}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {importing
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
                      : <><CheckCircle className="h-4 w-4" /> Importar {items.length - errorCount} cartel{items.length - errorCount !== 1 ? 'es' : ''}{errorCount > 0 ? ` (${errorCount} con error omitido${errorCount !== 1 ? 's' : ''})` : ''}</>
                    }
                  </button>
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
                        <p className="text-sm text-slate-400">Procesando archivo…</p>
                        {(file?.type === 'application/pdf' || file?.type?.startsWith('image/')) && (
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

          {/* ──── PASOS 2–6: Placeholder ──── */}
          {step > 1 && (
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
