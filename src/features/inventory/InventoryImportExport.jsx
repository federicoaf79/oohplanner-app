import { useState, useRef, useEffect } from 'react'
import { X, Download, CheckCircle, AlertTriangle, FileText, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import * as XLSX from 'xlsx'

const ROLLBACK_TTL_MS = 120 * 60 * 1000 // 2 horas

// ── Formatos para el selector de exportación ──────────────────

const FORMAT_OPTIONS = [
  { id: 'billboard',               label: 'Espectaculares',            fileLabel: 'Espectaculares' },
  { id: 'digital',                 label: 'Digitales LED',             fileLabel: 'Digitales_LED' },
  { id: 'ambient',                 label: 'Medianeras',                fileLabel: 'Medianeras' },
  { id: 'poster',                  label: 'Afiches',                   fileLabel: 'Afiches' },
  { id: 'urban_furniture',         label: 'Mobiliario Urbano',         fileLabel: 'Mobiliario_Urbano' },
  { id: 'urban_furniture_digital', label: 'Mobiliario Urbano Digital', fileLabel: 'Mobiliario_Urbano_Digital' },
  { id: 'mobile_screen',           label: 'Pantallas Móviles',         fileLabel: 'Pantallas_Moviles' },
]

// ── Columnas del CSV en español ───────────────────────────────

const CSV_COLS_ES = [
  'codigo', 'nombre', 'direccion', 'ciudad', 'formato',
  'ancho_m', 'alto_m', 'tipo_propiedad', 'iluminado',
  'latitud', 'longitud', 'precio_mensual', 'precio_quincenal',
  'banda_negativa', 'precio_banda_negativa', 'meses_minimos_banda',
  'costo_alquiler', 'costo_luz', 'costo_impuestos',
  'costo_mantenimiento', 'costo_imponderables',
  'costo_dueno_cartel', 'costo_impresion_m2',
  'costo_instalacion', 'costo_diseno',
  'comision_vendedor_pct', 'comision_agencia_pct', 'comision_dueno_pct',
]

// Mapeo columnas en español → claves internas en inglés
const ES_TO_EN = {
  codigo:                 'code',
  nombre:                 'name',
  direccion:              'address',
  ciudad:                 'city',
  formato:                'format',
  ancho_m:                'width_m',
  alto_m:                 'height_m',
  tipo_propiedad:         'owner_type',
  iluminado:              'is_illuminated',
  latitud:                'lat',
  longitud:               'lon',
  precio_mensual:         'base_rate',
  precio_quincenal:       'biweekly_rate',
  banda_negativa:         'banda_negativa_enabled',
  precio_banda_negativa:  'banda_negativa_rate',
  meses_minimos_banda:    'banda_negativa_min_months',
  costo_alquiler:         'cost_rent',
  costo_luz:              'cost_electricity',
  costo_impuestos:        'cost_taxes',
  costo_mantenimiento:    'cost_maintenance',
  costo_imponderables:    'cost_imponderables',
  costo_dueno_cartel:     'cost_owner_commission',
  costo_impresion_m2:     'cost_print_per_m2',
  costo_instalacion:      'cost_installation',
  costo_diseno:           'cost_design',
  comision_vendedor_pct:  'cost_seller_commission_pct',
  comision_agencia_pct:   'cost_agency_commission_pct',
  comision_dueno_pct:     'cost_owner_commission_pct',
}

// ── Rollback helpers ──────────────────────────────────────────

function bkKey(orgId) { return `inventory_backup_${orgId}` }

function loadBackup(orgId) {
  try {
    const raw = localStorage.getItem(bkKey(orgId))
    if (!raw) return null
    const b = JSON.parse(raw)
    if (Date.now() - b.timestamp > ROLLBACK_TTL_MS) {
      localStorage.removeItem(bkKey(orgId))
      return null
    }
    return b
  } catch { return null }
}

function minutesLeft(timestamp) {
  return Math.max(0, Math.floor((timestamp + ROLLBACK_TTL_MS - Date.now()) / 60000))
}

// ── Export helpers ────────────────────────────────────────────

function buildFilename(exportAll, selectedFormats) {
  const date = new Date().toISOString().slice(0, 10)
  if (exportAll || selectedFormats.size === 0) return `inventario_completo_${date}.xlsx`
  const label = FORMAT_OPTIONS
    .filter(f => selectedFormats.has(f.id))
    .map(f => f.fileLabel)
    .join('_')
  return `inventario_${label}_${date}.xlsx`
}

function DISABLED_escapeCSV(v) {
  const s = String(v ?? '')
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function DISABLED_buildCSV(items) {
  const toRow = (item) => [
    item.code ?? '',
    item.name ?? '',
    item.address ?? '',
    item.city ?? '',
    item.format ?? '',
    item.width_ft ?? '',
    item.height_ft ?? '',
    item.owner_type ?? 'owned',
    item.illuminated ? 'true' : 'false',
    item.latitude ?? '',
    item.longitude ?? '',
    item.base_rate ?? '',
    item.biweekly_rate ?? '',
    item.banda_negativa_enabled ? 'true' : 'false',
    item.banda_negativa_rate ?? '',
    item.banda_negativa_min_months ?? '',
    item.cost_rent ?? '',
    item.cost_electricity ?? '',
    item.cost_taxes ?? '',
    item.cost_maintenance ?? '',
    item.cost_imponderables ?? '',
    item.cost_owner_commission ?? '',
    item.cost_print_per_m2 ?? '',
    item.cost_installation ?? '',
    item.cost_design ?? '',
    item.cost_seller_commission_pct ?? '',
    item.cost_agency_commission_pct ?? '',
    item.cost_owner_commission_pct ?? '',
  ]
  const header = CSV_COLS_ES.join(',')
  const rows   = items.map(item => toRow(item).map(escapeCSV).join(','))
  return '\uFEFF' + [header, ...rows].join('\n') // BOM for Excel
}

// ── Export XLSX ───────────────────────────────────────────────

function buildXLSX(items) {
  const toRow = (item) => [
    item.code ?? '',
    item.name ?? '',
    item.address ?? '',
    item.city ?? '',
    item.format ?? '',
    item.width_ft ?? '',
    item.height_ft ?? '',
    item.owner_type ?? 'owned',
    item.illuminated ? 'SI' : 'NO',
    item.latitude ?? '',
    item.longitude ?? '',
    item.base_rate ?? '',
    item.biweekly_rate ?? '',
    item.banda_negativa_enabled ? 'SI' : 'NO',
    item.banda_negativa_rate ?? '',
    item.banda_negativa_min_months ?? '',
    item.cost_rent ?? '',
    item.cost_electricity ?? '',
    item.cost_taxes ?? '',
    item.cost_maintenance ?? '',
    item.cost_imponderables ?? '',
    item.cost_owner_commission ?? '',
    item.cost_print_per_m2 ?? '',
    item.cost_installation ?? '',
    item.cost_design ?? '',
    item.cost_seller_commission_pct ?? '',
    item.cost_agency_commission_pct ?? '',
    item.cost_owner_commission_pct ?? '',
  ]
  const ws = XLSX.utils.aoa_to_sheet([CSV_COLS_ES, ...items.map(toRow)])
  ws['!cols'] = CSV_COLS_ES.map(h => ({ wch: Math.max(h.length + 4, 16) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
}

// ── Import helpers ────────────────────────────────────────────

// Traduce claves en español → inglés interno. Si ya vienen en inglés, las pasa tal cual.
function normalizeRow(row) {
  const keys = Object.keys(row)
  const isSpanish = keys.some(k => k in ES_TO_EN)
  if (!isSpanish) return row
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    out[ES_TO_EN[k] ?? k] = v
  }
  return out
}

function rowToPayload(row, orgId) {
  const parseBool = (v) => {
    const s = String(v ?? '').toLowerCase().trim()
    return s === 'true' || s === '1' || s === 'si' || s === 'sí' || s === 'yes'
  }
  const parseNum = (v, fallback = null) => {
    const n = Number(v)
    return v !== '' && v != null && !isNaN(n) ? n : fallback
  }
  return {
    org_id:                     orgId,
    code:                       String(row.code ?? '').trim(),
    name:                       String(row.name ?? '').trim(),
    address:                    String(row.address ?? '').trim() || null,
    city:                       String(row.city ?? '').trim() || null,
    format:                     String(row.format ?? '').trim() || null,
    width_ft:                   parseNum(row.width_m),
    height_ft:                  parseNum(row.height_m),
    owner_type:                 ['owned', 'rented'].includes(row.owner_type) ? row.owner_type : 'owned',
    illuminated:                parseBool(row.is_illuminated),
    latitude:                   parseNum(row.lat),
    longitude:                  parseNum(row.lon),
    base_rate:                  parseNum(row.base_rate),
    biweekly_rate:              parseNum(row.biweekly_rate),
    banda_negativa_enabled:     parseBool(row.banda_negativa_enabled),
    banda_negativa_rate:        parseNum(row.banda_negativa_rate, 0),
    banda_negativa_min_months:  parseNum(row.banda_negativa_min_months, 6),
    cost_rent:                  parseNum(row.cost_rent, 0),
    cost_electricity:           parseNum(row.cost_electricity, 0),
    cost_taxes:                 parseNum(row.cost_taxes, 0),
    cost_maintenance:           parseNum(row.cost_maintenance, 0),
    cost_imponderables:         parseNum(row.cost_imponderables, 0),
    cost_owner_commission:      parseNum(row.cost_owner_commission, 0),
    cost_print_per_m2:          parseNum(row.cost_print_per_m2, 0),
    cost_installation:          parseNum(row.cost_installation, 0),
    cost_design:                parseNum(row.cost_design, 0),
    cost_seller_commission_pct: parseNum(row.cost_seller_commission_pct, 5),
    cost_agency_commission_pct: parseNum(row.cost_agency_commission_pct, 0),
    cost_owner_commission_pct:  parseNum(row.cost_owner_commission_pct, 0),
  }
}

// ── RollbackBanner (exportado para usar en Inventory.jsx) ─────

export function RollbackBanner({ orgId, onRollbackDone }) {
  const [backup, setBackup]   = useState(() => loadBackup(orgId))
  const [mins, setMins]       = useState(() => { const b = loadBackup(orgId); return b ? minutesLeft(b.timestamp) : 0 })
  const [rolling, setRolling] = useState(false)
  const [error, setError]     = useState('')

  // Refrescar cuando cambia orgId (ej: después de import)
  useEffect(() => {
    const b = loadBackup(orgId)
    setBackup(b)
    setMins(b ? minutesLeft(b.timestamp) : 0)
    setError('')
  }, [orgId])

  // Contador regresivo
  useEffect(() => {
    if (!backup) return
    const id = setInterval(() => {
      const m = minutesLeft(backup.timestamp)
      setMins(m)
      if (m <= 0) { localStorage.removeItem(bkKey(orgId)); setBackup(null) }
    }, 30_000)
    return () => clearInterval(id)
  }, [backup, orgId])

  if (!backup || mins <= 0) return null

  async function handleRollback() {
    setRolling(true)
    setError('')
    try {
      for (const item of (backup.updatedItems ?? [])) {
        const { error: e } = await supabase.from('inventory').update(item).eq('id', item.id)
        if (e) throw e
      }
      if (backup.insertedIds?.length) {
        const { error: e } = await supabase.from('inventory').delete().in('id', backup.insertedIds)
        if (e) throw e
      }
      localStorage.removeItem(bkKey(orgId))
      setBackup(null)
      onRollbackDone?.()
    } catch (err) {
      setError(`Error al revertir: ${err.message}`)
    } finally {
      setRolling(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <RotateCcw className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Importación completada</p>
            <p className="text-xs text-amber-400/70">
              Tenés {mins} {mins === 1 ? 'minuto' : 'minutos'} para revertir los cambios si encontrás algún error.
            </p>
          </div>
        </div>
        <button type="button" onClick={handleRollback} disabled={rolling}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
          {rolling
            ? <Spinner size="sm" className="border-amber-400/30 border-t-amber-400" />
            : <RotateCcw className="h-3 w-3" />
          }
          Revertir importación
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function InventoryImportExport({ items, orgName, orgId, onImported, onClose }) {
  const [tab, setTab]                               = useState('export')
  const [importing, setImporting]                   = useState(false)
  const [result, setResult]                         = useState(null)
  const [showCategorySelector, setShowCategorySelector] = useState(false)
  const [exportAll, setExportAll]                   = useState(true)
  const [selectedFormats, setSelectedFormats]       = useState(new Set())
  const [backup, setBackup]                         = useState(() => loadBackup(orgId))
  const [mins, setMins]                             = useState(() => { const b = loadBackup(orgId); return b ? minutesLeft(b.timestamp) : 0 })
  const [rolling, setRolling]                       = useState(false)
  const [rollbackError, setRollbackError]           = useState('')
  const fileRef = useRef(null)

  // Contador regresivo del rollback
  useEffect(() => {
    if (!backup) return
    const id = setInterval(() => {
      const m = minutesLeft(backup.timestamp)
      setMins(m)
      if (m <= 0) { localStorage.removeItem(bkKey(orgId)); setBackup(null) }
    }, 30_000)
    return () => clearInterval(id)
  }, [backup, orgId])

  function refreshBackup() {
    const b = loadBackup(orgId)
    setBackup(b)
    setMins(b ? minutesLeft(b.timestamp) : 0)
  }

  // ── Export ──────────────────────────────────────────────────

  function toggleFormat(id) {
    if (exportAll) {
      setExportAll(false)
      setSelectedFormats(new Set([id]))
    } else {
      const next = new Set(selectedFormats)
      next.has(id) ? next.delete(id) : next.add(id)
      setSelectedFormats(next)
    }
  }

  function handleExport() {
    const toExport = exportAll || selectedFormats.size === 0
      ? items
      : items.filter(i => selectedFormats.has(i.format))
    const filename = buildFilename(exportAll, selectedFormats, orgName)
    const xlsxData = buildXLSX(toExport)
    const blob     = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url      = URL.createObjectURL(blob)
    const a        = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    setShowCategorySelector(false)
  }

  // ── Import ──────────────────────────────────────────────────

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setResult(null)

    try {
      let rawRows = []

      if (file.name.endsWith('.csv')) {
        const Papa = (await import('papaparse')).default
        rawRows = await new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: r => resolve(r.data),
            error:   err => reject(err),
          })
        })
      } else if (file.name.match(/\.xlsx?$/i)) {
        const XLSX   = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb     = XLSX.read(buffer, { type: 'array' })
        const ws     = wb.Sheets[wb.SheetNames[0]]
        rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      } else {
        throw new Error('Formato no soportado. Usá CSV o XLSX.')
      }

      if (rawRows.length === 0) throw new Error('El archivo está vacío.')

      // Normalizar: español → inglés interno (con compat retroactiva)
      const rows = rawRows.map(normalizeRow)

      // Validar columnas requeridas
      const headers = Object.keys(rows[0])
      const missing = ['code', 'name'].filter(c => !headers.includes(c))
      if (missing.length) {
        throw new Error(`Columnas requeridas faltantes: ${missing.join(', ')} (o en español: codigo, nombre)`)
      }

      // Obtener inventario completo actual (para backup y lógica de upsert)
      const { data: existing, error: fetchErr } = await supabase
        .from('inventory')
        .select('*')
        .eq('org_id', orgId)
      if (fetchErr) throw fetchErr

      const importCodes = new Set(
        rows.map(r => String(r.code ?? '').trim().toLowerCase()).filter(Boolean)
      )

      const existingByCode = {}
      const itemsToBackup  = []
      ;(existing ?? []).forEach(i => {
        if (!i.code) return
        const key = i.code.toLowerCase()
        existingByCode[key] = i.id
        if (importCodes.has(key)) itemsToBackup.push(i)
      })

      // Procesar fila por fila
      const stats = { updated: 0, inserted: 0, errors: [], insertedIds: [] }

      for (const [idx, row] of rows.entries()) {
        const code = String(row.code ?? '').trim()
        if (!code) {
          stats.errors.push({ row: idx + 2, msg: 'Código vacío — fila omitida' })
          continue
        }

        const payload = rowToPayload(row, orgId)
        if (payload.biweekly_rate == null)             delete payload.biweekly_rate
        if (payload.cost_owner_commission_pct == null)  delete payload.cost_owner_commission_pct

        try {
          const existingId = existingByCode[code.toLowerCase()]
          if (existingId) {
            const { error } = await supabase.from('inventory').update(payload).eq('id', existingId)
            if (error) throw error
            stats.updated++
          } else {
            const { data: inserted, error } = await supabase
              .from('inventory').insert(payload).select('id').single()
            if (error) throw error
            stats.inserted++
            if (inserted?.id) stats.insertedIds.push(inserted.id)
          }
        } catch (err) {
          stats.errors.push({ row: idx + 2, msg: err.message })
        }
      }

      // Guardar backup para rollback
      if (itemsToBackup.length > 0 || stats.insertedIds.length > 0) {
        localStorage.setItem(bkKey(orgId), JSON.stringify({
          updatedItems: itemsToBackup,
          insertedIds:  stats.insertedIds,
          timestamp:    Date.now(),
        }))
        refreshBackup()
      }

      setResult(stats)
      if (stats.inserted + stats.updated > 0) onImported()
    } catch (err) {
      setResult({ updated: 0, inserted: 0, errors: [{ row: '—', msg: err.message }], insertedIds: [] })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  // ── Rollback (desde el modal) ────────────────────────────────

  async function handleRollback() {
    if (!backup) return
    setRolling(true)
    setRollbackError('')
    try {
      for (const item of (backup.updatedItems ?? [])) {
        const { error: e } = await supabase.from('inventory').update(item).eq('id', item.id)
        if (e) throw e
      }
      if (backup.insertedIds?.length) {
        const { error: e } = await supabase.from('inventory').delete().in('id', backup.insertedIds)
        if (e) throw e
      }
      localStorage.removeItem(bkKey(orgId))
      setBackup(null)
      setMins(0)
      setResult(null)
      onImported()
    } catch (err) {
      setRollbackError(`Error al revertir: ${err.message}`)
    } finally {
      setRolling(false)
    }
  }

  // ── Template download ─────────────────────────────────────────

  async function downloadTemplate() {
    const XLSX = await import('xlsx')

    const EXAMPLE = [
      'BLL001',
      'Cartel Av. Libertador',
      'Av. Libertador 1234',
      'Buenos Aires (CABA)',
      'billboard',
      12.5,
      4,
      'rented',
      'si',
      -34.5765,
      -58.4123,
      85000,
      45000,
      'no',
      0,
      0,
      15000,
      2000,
      500,
      1000,
      500,
      5000,
      1200,
      3000,
      1500,
      5,
      0,
      0,
    ]

    // Hoja principal: encabezados + fila ejemplo
    const ws = XLSX.utils.aoa_to_sheet([CSV_COLS_ES, EXAMPLE])

    // Negrita en encabezados (fila 0)
    CSV_COLS_ES.forEach((_, colIdx) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: colIdx })
      if (ws[ref]) ws[ref].s = { font: { bold: true, name: 'Calibri', sz: 11 } }
    })

    // Anchos de columna proporcionales a la longitud del encabezado
    ws['!cols'] = CSV_COLS_ES.map(h => ({ wch: Math.max(h.length + 4, 14) }))

    // Hoja de referencia
    const REF_ROWS = [
      ['Campo',            'Valores válidos / Notas'],
      ['formato',          'billboard · digital · ambient · poster · urban_furniture · urban_furniture_digital · mobile_screen'],
      ['tipo_propiedad',   'owned · rented'],
      ['iluminado',        'si · no'],
      ['banda_negativa',   'si · no'],
      ['',                 ''],
      ['NOTAS',            ''],
      ['ancho_m / alto_m',       'Medidas en metros con punto decimal. Ej: 12.5'],
      ['latitud / longitud',     'Coordenadas decimales. Ej: -34.5765 / -58.4123'],
      ['precio_mensual',         'Precio en moneda local, sin separadores de miles'],
      ['comision_*_pct',         'Porcentaje como número entero. Ej: 5 = 5 %'],
      ['codigo',                 'Si el código ya existe en la plataforma, esa fila ACTUALIZA el cartel existente'],
    ]

    const wsRef = XLSX.utils.aoa_to_sheet(REF_ROWS)
    wsRef['!cols'] = [{ wch: 24 }, { wch: 88 }]
    ;['A1', 'B1', 'A7'].forEach(ref => {
      if (wsRef[ref]) wsRef[ref].s = { font: { bold: true, name: 'Calibri', sz: 11 } }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
    XLSX.utils.book_append_sheet(wb, wsRef, 'Referencia')

    XLSX.writeFile(wb, 'plantilla_inventario_oohplanner.xlsx')
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-700 px-5 py-4 sticky top-0 bg-surface-900 z-10">
          <p className="font-semibold text-white">Importar / Exportar inventario</p>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-700 transition-colors">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-700 px-5 sticky top-[57px] bg-surface-900 z-10">
          {[
            { id: 'export', label: 'Exportar Excel' },
            { id: 'import', label: 'Importar CSV / Excel' },
          ].map(t => (
            <button key={t.id}
              onClick={() => { setTab(t.id); setResult(null); setShowCategorySelector(false) }}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">

          {/* ── Exportar: descripción + botón ── */}
          {tab === 'export' && !showCategorySelector && (
            <>
              <p className="text-sm text-slate-400">
                Descargá un Excel con los carteles de tu inventario, incluyendo costos y configuración.
                Podés editarlo y reimportarlo.
              </p>
              <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4 text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-400">Columnas incluidas ({CSV_COLS_ES.length}):</p>
                <p className="font-mono leading-relaxed">{CSV_COLS_ES.join(' · ')}</p>
              </div>
              <Button className="w-full" onClick={() => setShowCategorySelector(true)}>
                <Download className="h-4 w-4" />
                Descargar Excel ({items.length} carteles)
              </Button>
              <a
                href="/plantilla_inventario_oohplanner.xlsx"
                download
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-surface-700 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 hover:border-brand/30 transition-colors"
              >
                <Download className="h-4 w-4" />
                Descargar plantilla vacía
              </a>
            </>
          )}

          {/* ── Exportar: selector de categoría ── */}
          {tab === 'export' && showCategorySelector && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-white mb-0.5">¿Qué querés exportar?</p>
                <p className="text-xs text-slate-500">Podés elegir uno o varios formatos.</p>
              </div>

              <div className="space-y-2">
                {/* Opción: todo */}
                <label className="flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-800/50 px-3.5 py-2.5 cursor-pointer hover:border-brand/30 transition-colors">
                  <input type="checkbox" checked={exportAll}
                    onChange={() => { setExportAll(true); setSelectedFormats(new Set()) }}
                    className="h-4 w-4 rounded accent-brand" />
                  <div>
                    <p className="text-sm font-medium text-white">Todo el inventario</p>
                    <p className="text-xs text-slate-500">{items.length} carteles</p>
                  </div>
                </label>

                {/* Opciones por formato (solo los que tienen ítems) */}
                {FORMAT_OPTIONS.map(fmt => {
                  const count = items.filter(i => i.format === fmt.id).length
                  if (count === 0) return null
                  return (
                    <label key={fmt.id} className="flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-800/50 px-3.5 py-2.5 cursor-pointer hover:border-brand/30 transition-colors">
                      <input type="checkbox"
                        checked={!exportAll && selectedFormats.has(fmt.id)}
                        onChange={() => toggleFormat(fmt.id)}
                        className="h-4 w-4 rounded accent-brand" />
                      <div>
                        <p className="text-sm font-medium text-slate-200">Solo {fmt.label}</p>
                        <p className="text-xs text-slate-500">{count} carteles</p>
                      </div>
                    </label>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCategorySelector(false)}
                  className="flex-1 rounded-lg border border-surface-700 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                  Cancelar
                </button>
                <Button className="flex-1" onClick={handleExport}
                  disabled={!exportAll && selectedFormats.size === 0}>
                  <Download className="h-4 w-4" />
                  Descargar
                </Button>
              </div>
            </div>
          )}

          {/* ── Importar ── */}
          {tab === 'import' && (
            <>
              <p className="text-sm text-slate-400">
                Subí un CSV o Excel. Si el código (<code className="text-brand">codigo</code>) ya existe,
                se actualiza. Si es nuevo, se inserta.
              </p>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300 space-y-1">
                <p className="font-semibold">Columnas requeridas: <span className="font-mono">codigo, nombre</span></p>
                <p>El resto es opcional. También acepta columnas en inglés para compatibilidad con imports anteriores.</p>
              </div>

              <button
                type="button"
                onClick={downloadTemplate}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/10 py-2.5 text-sm font-medium text-brand hover:bg-brand/20 transition-colors"
              >
                <Download className="h-4 w-4" />
                Descargar plantilla vacía (.xlsx)
              </button>

              {!importing && !result && (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-700 py-8 text-sm text-slate-500 hover:border-brand/50 hover:text-slate-300 transition-colors">
                  <FileText className="h-8 w-8" />
                  <span>Seleccioná un archivo CSV o XLSX</span>
                  <span className="text-xs text-slate-600">Clic aquí para elegir el archivo</span>
                </button>
              )}

              {importing && (
                <div className="flex items-center justify-center gap-3 py-8">
                  <Spinner size="md" />
                  <span className="text-sm text-slate-400">Importando...</span>
                </div>
              )}

              {result && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <p className="text-xl font-bold text-emerald-400">{result.updated}</p>
                      <p className="text-xs text-slate-500">Actualizados</p>
                    </div>
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                      <p className="text-xl font-bold text-blue-400">{result.inserted}</p>
                      <p className="text-xs text-slate-500">Nuevos</p>
                    </div>
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                      <p className="text-xl font-bold text-red-400">{result.errors.length}</p>
                      <p className="text-xs text-slate-500">Errores</p>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-1">
                      {result.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-400">
                          <span className="font-mono font-semibold">Fila {err.row}:</span> {err.msg}
                        </p>
                      ))}
                    </div>
                  )}

                  <button type="button" onClick={() => setResult(null)}
                    className="w-full rounded-lg border border-surface-700 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                    Importar otro archivo
                  </button>
                </div>
              )}

              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </>
          )}

          {/* ── Banner de rollback (dentro del modal) ── */}
          {backup && mins > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <RotateCcw className="h-4 w-4 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Importación completada</p>
                    <p className="text-xs text-amber-400/70">
                      Tenés {mins} {mins === 1 ? 'minuto' : 'minutos'} para revertir los cambios si encontrás algún error.
                    </p>
                  </div>
                </div>
                <button type="button" onClick={handleRollback} disabled={rolling}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                  {rolling
                    ? <Spinner size="sm" className="border-amber-400/30 border-t-amber-400" />
                    : <RotateCcw className="h-3 w-3" />
                  }
                  Revertir importación
                </button>
              </div>
              {rollbackError && <p className="text-xs text-red-400">{rollbackError}</p>}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
