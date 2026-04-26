import { useState, useRef } from 'react'
import {
  X, Upload, FileSpreadsheet, AlertTriangle, Check,
  RefreshCw, Users, Sparkles, Info, ChevronRight, ChevronLeft,
  Table2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { CONTACT_ROLES, ROLE_LABEL_MAP } from '../../lib/contactRoles'

// ─── Schema fields ────────────────────────────────────────────────────────────
const SCHEMA_FIELDS = [
  'name', 'legal_name', 'tax_id', 'email', 'phone', 'whatsapp',
  'website', 'address', 'city', 'province',
  'contact_person_name', 'contact_person_role',
  'contact_person_email', 'contact_person_phone',
  'roles', 'notes',
]

// ─── Fallback sin IA ──────────────────────────────────────────────────────────
const AUTO_MAP = {
  'nombre': 'name', 'name': 'name', 'empresa': 'name', 'compania': 'name',
  'company': 'name', 'cliente': 'name', 'nombre fantasia': 'name',
  'nombre de fantasia': 'name', 'fantasia': 'name',
  'razon social': 'legal_name', 'razon_social': 'legal_name',
  'cuit': 'tax_id', 'cuil': 'tax_id', 'cuit/cuil': 'tax_id', 'nro cuit': 'tax_id',
  'email': 'email', 'mail': 'email', 'correo': 'email', 'e-mail': 'email',
  'telefono': 'phone', 'telefonos': 'phone', 'teléfono': 'phone',
  'tel': 'phone', 'phone': 'phone', 'celular': 'phone', 'movil': 'phone',
  'whatsapp': 'whatsapp', 'wsp': 'whatsapp',
  'web': 'website', 'website': 'website', 'sitio': 'website', 'url': 'website',
  'direccion': 'address', 'dirección': 'address', 'domicilio': 'address',
  'ciudad': 'city', 'city': 'city', 'localidad': 'city',
  'provincia': 'province', 'province': 'province',
  'rol': 'roles', 'role': 'roles', 'roles': 'roles', 'tipo': 'roles', 'rubro': 'roles',
  'contacto': 'contact_person_name', 'encargado': 'contact_person_name',
  'responsable': 'contact_person_name', 'referente': 'contact_person_name',
  'cargo': 'contact_person_role', 'puesto': 'contact_person_role',
  'notas': 'notes', 'observaciones': 'notes', 'comentarios': 'notes',
}

function normalize(str) {
  return String(str ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ─── Parsers ──────────────────────────────────────────────────────────────────
async function loadWorkbook(file) {
  const XLSXmod = await import('xlsx')
  const XLSX = XLSXmod.default ?? XLSXmod
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  return { wb, XLSX }
}

function parseSheet(wb, XLSX, sheetName) {
  const ws = wb.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 })
  if (!raw.length) return []

  // Encontrar fila de headers: primera con al menos 2 celdas no vacías
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(raw.length, 6); i++) {
    if (raw[i].filter(v => v !== '' && v != null).length >= 2) {
      headerRowIdx = i; break
    }
  }

  const headers = raw[headerRowIdx].map((h, i) =>
    String(h ?? '').trim() || `Col_${i + 1}`
  )

  return raw.slice(headerRowIdx + 1)
    .filter(row => row.some(v => v !== '' && v != null))
    .map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])))
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
  const rows = Array.from(table.querySelectorAll('tr'))
  if (rows.length < 2) throw new Error('La tabla del documento está vacía.')
  const headers = Array.from(rows[0].querySelectorAll('td,th'))
    .map((c, i) => c.textContent.trim() || `Col_${i + 1}`)
  return {
    sheetNames: ['Tabla Word'],
    rows: rows.slice(1)
      .map(row => {
        const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.textContent.trim())
        const obj = {}
        headers.forEach((h, i) => { obj[h] = cells[i] ?? '' })
        return obj
      })
      .filter(r => Object.values(r).some(v => v))
  }
}

async function parseFile(file, sheetName = null) {
  const name = file.name.toLowerCase()

  if (/\.docx$/.test(name)) {
    return parseDocx(file)
  }

  if (/\.(xlsx|xls|csv|ods)$/.test(name)) {
    const { wb, XLSX } = await loadWorkbook(file)
    const sheetNames = wb.SheetNames
    const targetSheet = sheetName ?? sheetNames[0]
    const rows = parseSheet(wb, XLSX, targetSheet)
    return { sheetNames, rows }
  }

  throw new Error('Formato no soportado. Usá .xlsx, .xls, .csv, .ods o .docx')
}

// ─── AI mapping ───────────────────────────────────────────────────────────────
async function aiMapColumns(columns, sampleRows) {
  const samples = columns.slice(0, 30).map(col => {
    const vals = sampleRows.map(r => String(r[col] ?? '')).filter(Boolean).slice(0, 3)
    return `"${col}": [${vals.map(v => `"${v.slice(0, 40)}"`).join(', ')}]`
  }).join('\n')

  const prompt = `Mapeá estas columnas de una planilla de contactos comerciales al schema.

Schema válido: ${SCHEMA_FIELDS.join(', ')}, __ignore__

Reglas:
- Si la columna tiene nombres de empresa o persona → "name"
- Si todos los valores son iguales o genéricos (ej: todos dicen "cliente") → "__ignore__"
- Fax, canal, código postal, número correlativo, días de visita, horarios → "__ignore__"
- Si no corresponde a ningún campo → "__ignore__"

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
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    const validIds = new Set([...SCHEMA_FIELDS, '__ignore__'])
    const safe = {}
    columns.forEach(col => {
      const s = parsed[col]
      safe[col] = validIds.has(s) ? s : (AUTO_MAP[normalize(col)] ?? '__ignore__')
    })
    return safe
  } catch {
    const safe = {}
    columns.forEach(col => { safe[col] = AUTO_MAP[normalize(col)] ?? '__ignore__' })
    return safe
  }
}

// ─── Roles ────────────────────────────────────────────────────────────────────
const ROLE_ALIASES = {}
CONTACT_ROLES.forEach(r => {
  ROLE_ALIASES[normalize(r.id)] = r.id
  ROLE_ALIASES[normalize(r.label)] = r.id
})
Object.assign(ROLE_ALIASES, {
  'anunciante': 'advertiser', 'agencia': 'agency', 'facilitador': 'facilitator',
  'impresor': 'printer', 'colocador': 'installer', 'propietario': 'landlord',
  'proveedor': 'supplier', 'municipio': 'municipality',
})
function parseRoleValue(val) {
  return String(val ?? '').split(/[,;|\/]/)
    .map(v => ROLE_ALIASES[normalize(v)] ?? null).filter(Boolean)
}

function applyMapping(rows, mapping) {
  const rolesCol = Object.entries(mapping).find(([, v]) => v === 'roles')?.[0]
  return rows.map(row => {
    const contact = {}
    Object.entries(mapping).forEach(([col, field]) => {
      if (field === '__ignore__' || field === 'roles') return
      const val = String(row[col] ?? '').trim()
      if (val) contact[field] = val
    })
    contact.roles = rolesCol ? parseRoleValue(row[rolesCol]) : []
    contact.__key__ = contact.tax_id || contact.email || null
    return contact
  }).filter(c => c.name)
}

// ─── Helper exportado ─────────────────────────────────────────────────────────
export function contactNeedsReview(contact) {
  return !contact.email && !contact.phone && !contact.whatsapp
}

// ─── STEP 0: Upload ───────────────────────────────────────────────────────────
function StepUpload({ onFileLoaded }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file) return
    if (!/\.(xlsx|xls|csv|ods|docx)$/i.test(file.name)) {
      setError('Formato no soportado. Usá .xlsx, .xls, .csv, .ods o .docx')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const result = await parseFile(file)
      onFileLoaded({ file, ...result })
    } catch (e) {
      setError(e.message ?? 'Error al procesar el archivo.')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Importar contactos</h2>
        <p className="mt-1 text-sm text-slate-400">
          Subí tu lista. El sistema detecta las columnas automáticamente.
        </p>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => !loading && inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors ${
          loading   ? 'border-blue-400/50 bg-blue-500/5 cursor-default' :
          dragging  ? 'border-blue-400 bg-blue-500/10 cursor-copy' :
          'border-surface-600 hover:border-surface-500 bg-surface-800/50 cursor-pointer'
        }`}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.ods,.docx"
          className="hidden" onChange={e => handleFile(e.target.files[0])} />
        {loading ? (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
              <Sparkles className="h-7 w-7 text-blue-400 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-medium text-slate-200">Leyendo archivo…</p>
              <p className="mt-1 text-xs text-slate-500">Detectando estructura</p>
            </div>
          </>
        ) : (
          <>
            <FileSpreadsheet className="h-10 w-10 text-slate-500" />
            <div className="text-center">
              <p className="font-medium text-slate-300">Arrastrá tu archivo acá</p>
              <p className="mt-1 text-xs text-slate-500">o hacé clic para seleccionar</p>
              <p className="mt-2 text-xs text-slate-600">.xlsx · .xls · .csv · .ods · .docx</p>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-2 rounded-lg bg-surface-800 border border-surface-700 p-3 text-xs text-slate-400">
        <Info className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
        <span>
          <span className="font-medium text-slate-300">¿Usás Apple Numbers o Pages?</span>{' '}
          Exportá como .xlsx desde <span className="text-slate-200">Archivo → Exportar → Excel</span>.
        </span>
      </div>
    </div>
  )
}

// ─── STEP 1: Selector de pestaña (solo si hay más de 1) ───────────────────────
function StepSheetSelector({ sheetNames, file, onSheetSelected, onBack }) {
  const [selected, setSelected] = useState(sheetNames[0])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function confirm() {
    setLoading(true)
    setError(null)
    try {
      const result = await parseFile(file, selected)
      onSheetSelected(result.rows, selected)
    } catch (e) {
      setError(e.message ?? 'Error al leer la pestaña.')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Elegir pestaña</h2>
        <p className="mt-1 text-sm text-slate-400">
          Tu archivo tiene {sheetNames.length} pestañas. ¿Cuál contiene los contactos?
        </p>
      </div>

      <div className="space-y-2">
        {sheetNames.map((name, i) => (
          <button
            key={name}
            onClick={() => setSelected(name)}
            className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
              selected === name
                ? 'border-blue-500/40 bg-blue-500/10 text-white'
                : 'border-surface-700 bg-surface-800 text-slate-300 hover:border-surface-600'
            }`}
          >
            <Table2 className={`h-4 w-4 shrink-0 ${selected === name ? 'text-blue-400' : 'text-slate-500'}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{name}</p>
              <p className="text-xs text-slate-500">Pestaña {i + 1}</p>
            </div>
            {selected === name && (
              <div className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex items-center gap-2">
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <button onClick={confirm} disabled={loading}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          {loading
            ? <><RefreshCw className="h-4 w-4 animate-spin" /> Analizando…</>
            : <>Usar esta pestaña <ChevronRight className="h-4 w-4" /></>
          }
        </button>
      </div>
    </div>
  )
}

// ─── STEP 2: Analizar + Confirmar ─────────────────────────────────────────────
function StepConfirm({ mapped, existingContacts, onImport, importing, importResult, onBack }) {
  const withContact   = mapped.filter(c => c.email || c.phone || c.whatsapp).length
  const incomplete    = mapped.length - withContact
  const conflictCount = mapped.filter(c =>
    c.__key__ && existingContacts.some(e => e.tax_id === c.__key__ || e.email === c.__key__)
  ).length

  if (importResult) {
    return (
      <div className="space-y-6 py-4 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20">
            <Check className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">¡Importación completada!</h2>
          <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm">
            <span className="text-slate-400">
              <span className="text-blue-400 font-semibold text-base">{importResult.inserted}</span> nuevos
            </span>
            {importResult.updated > 0 && (
              <span className="text-slate-400">
                <span className="text-slate-300 font-semibold text-base">{importResult.updated}</span> actualizados
              </span>
            )}
            {importResult.skipped > 0 && (
              <span className="text-slate-400">
                <span className="text-slate-500 font-semibold text-base">{importResult.skipped}</span> salteados
              </span>
            )}
          </div>
          {importResult.needsReview > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400 max-w-sm mx-auto">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>{importResult.needsReview}</strong> contactos sin datos de contacto —
                aparecen marcados en la lista para completar después.
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Listo para importar</h2>
        <p className="mt-1 text-sm text-slate-400">Revisá el resumen y confirmá.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-800 border border-surface-700 p-4 text-center">
          <p className="text-2xl font-bold text-white">{mapped.length}</p>
          <p className="text-xs text-slate-400 mt-1">Contactos detectados</p>
        </div>
        <div className="rounded-xl bg-surface-800 border border-surface-700 p-4 text-center">
          <p className="text-2xl font-bold text-white">{withContact}</p>
          <p className="text-xs text-slate-400 mt-1">Con datos de contacto</p>
        </div>
        {incomplete > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{incomplete}</p>
            <p className="text-xs text-amber-400/70 mt-1">Sin email ni teléfono</p>
          </div>
        )}
        {conflictCount > 0 && (
          <div className="rounded-xl bg-surface-800 border border-surface-700 p-4 text-center">
            <p className="text-2xl font-bold text-slate-400">{conflictCount}</p>
            <p className="text-xs text-slate-500 mt-1">Ya existen (se actualizan)</p>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-surface-700 overflow-hidden">
        <div className="px-4 py-2 bg-surface-800 border-b border-surface-700">
          <p className="text-xs text-slate-400 font-medium">
            Vista previa · primeros {Math.min(mapped.length, 5)} de {mapped.length}
          </p>
        </div>
        <div className="divide-y divide-surface-700">
          {mapped.slice(0, 5).map((c, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {c.email || c.phone || c.city || '—'}
                </p>
              </div>
              {!c.email && !c.phone && !c.whatsapp && (
                <span className="text-xs text-amber-400 shrink-0">Sin contacto</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {incomplete > 0 && (
        <p className="text-xs text-slate-500">
          Los contactos sin datos se importan igual y quedan marcados con{' '}
          <span className="text-amber-400">"Completar datos"</span> en la lista.
        </p>
      )}

      <button onClick={onImport} disabled={importing}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3">
        {importing
          ? <><RefreshCw className="h-4 w-4 animate-spin" /> Importando…</>
          : <><Upload className="h-4 w-4" /> Importar {mapped.length} contactos</>
        }
      </button>

      <button onClick={onBack}
        className="w-full text-center text-xs text-slate-500 hover:text-slate-400 transition-colors">
        ← Subir otro archivo
      </button>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ContactOnboardingWizard({ existingContacts = [], onClose, onDone }) {
  const { profile } = useAuth()

  // step: 'upload' | 'sheet' | 'confirm'
  const [step, setStep]           = useState('upload')
  const [fileData, setFileData]   = useState(null)   // { file, sheetNames }
  const [rows, setRows]           = useState([])
  const [mapped, setMapped]       = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  async function analyzeAndConfirm(rawRows) {
    setAnalyzing(true)
    const columns = rawRows.length ? Object.keys(rawRows[0]) : []
    const mapping = await aiMapColumns(columns, rawRows.slice(0, 8))
    const result  = applyMapping(rawRows, mapping)
    setMapped(result)
    setAnalyzing(false)
    setStep('confirm')
  }

  async function handleFileLoaded(data) {
    setFileData(data)
    setRows(data.rows)

    // Si hay más de una pestaña → mostrar selector
    if (data.sheetNames.length > 1) {
      setStep('sheet')
    } else {
      // Pestaña única → analizar directo
      await analyzeAndConfirm(data.rows)
    }
  }

  async function handleSheetSelected(sheetRows) {
    setRows(sheetRows)
    await analyzeAndConfirm(sheetRows)
  }

  async function handleImport() {
    setImporting(true)
    let inserted = 0, updated = 0, skipped = 0, errors = 0, needsReview = 0
    const newContacts = []

    const existingKeys = new Set([
      ...existingContacts.map(c => c.tax_id).filter(Boolean),
      ...existingContacts.map(c => c.email).filter(Boolean),
    ])

    for (const row of mapped) {
      const { __key__, ...contact } = row
      contact.org_id     = profile.org_id
      contact.created_by = profile.id

      try {
        const isConflict = __key__ && existingKeys.has(__key__)

        if (isConflict) {
          const existing = existingContacts.find(
            c => c.tax_id === __key__ || c.email === __key__
          )
          if (existing) {
            const { data, error } = await supabase
              .from('contacts').update(contact).eq('id', existing.id).select().single()
            if (error) { errors++; continue }
            newContacts.push(data); updated++
            if (contactNeedsReview(data)) needsReview++
            continue
          }
        }

        const { data, error } = await supabase
          .from('contacts').insert(contact).select().single()
        if (error) { errors++; continue }
        newContacts.push(data); inserted++
        if (contactNeedsReview(data)) needsReview++
      } catch { errors++ }
    }

    setImportResult({ inserted, updated, skipped, errors, needsReview })
    setImporting(false)
    if (inserted + updated > 0) onDone(newContacts)
  }

  const STEP_LABELS = {
    upload:  'Subir archivo',
    sheet:   'Elegir pestaña',
    confirm: 'Importar',
  }
  const STEP_ORDER = ['upload', 'sheet', 'confirm']
  const visibleSteps = fileData?.sheetNames?.length > 1
    ? STEP_ORDER
    : ['upload', 'confirm']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-surface-900 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-400" />
            <div>
              <p className="font-semibold text-white">Importar contactos</p>
              <p className="text-xs text-slate-500">{STEP_LABELS[step]}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-surface-700 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress tabs */}
        <div className="flex border-b border-surface-700">
          {visibleSteps.map((s, i) => (
            <div key={s} className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${
              s === step         ? 'text-blue-400 border-b-2 border-blue-400' :
              i < visibleSteps.indexOf(step) ? 'text-slate-400' : 'text-slate-600'
            }`}>{STEP_LABELS[s]}</div>
          ))}
        </div>

        {/* Loader overlay cuando analiza IA */}
        {analyzing && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-surface-900/95">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
              <Sparkles className="h-7 w-7 text-blue-400 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-medium text-slate-200">La IA está analizando…</p>
              <p className="mt-1 text-xs text-slate-500">Detectando y mapeando columnas</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {step === 'upload' && (
            <StepUpload onFileLoaded={handleFileLoaded} />
          )}

          {step === 'sheet' && fileData && (
            <StepSheetSelector
              sheetNames={fileData.sheetNames}
              file={fileData.file}
              onSheetSelected={handleSheetSelected}
              onBack={() => setStep('upload')}
            />
          )}

          {step === 'confirm' && (
            <>
              <StepConfirm
                mapped={mapped}
                existingContacts={existingContacts}
                onImport={handleImport}
                importing={importing}
                importResult={importResult}
                onBack={() => setStep('upload')}
              />
              {importResult && (
                <div className="mt-4">
                  <button onClick={onClose} className="btn-primary w-full">Cerrar</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
