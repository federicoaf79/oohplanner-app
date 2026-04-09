import { useState, useRef } from 'react'
import { X, Download, Upload, CheckCircle, AlertTriangle, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

// ── Columnas del CSV ──────────────────────────────────────────

const CSV_COLS = [
  'code', 'name', 'address', 'city', 'format', 'width_m', 'height_m',
  'owner_type', 'is_illuminated', 'lat', 'lon',
  'base_rate', 'biweekly_rate',
  'banda_negativa_enabled', 'banda_negativa_rate', 'banda_negativa_min_months',
  'cost_rent', 'cost_electricity', 'cost_taxes',
  'cost_maintenance', 'cost_imponderables',
  'cost_owner_commission', 'cost_print_per_m2',
  'cost_installation', 'cost_design',
  'cost_seller_commission_pct', 'cost_agency_commission_pct',
  'cost_owner_commission_pct',
]

const REQUIRED_COLS = ['code', 'name']

// Mapeo CSV → columna DB
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
    org_id:                    orgId,
    code:                      String(row.code ?? '').trim(),
    name:                      String(row.name ?? '').trim(),
    address:                   String(row.address ?? '').trim() || null,
    city:                      String(row.city ?? '').trim() || null,
    format:                    String(row.format ?? '').trim() || null,
    width_ft:                  parseNum(row.width_m),
    height_ft:                 parseNum(row.height_m),
    owner_type:                ['owned', 'rented'].includes(row.owner_type) ? row.owner_type : 'owned',
    illuminated:               parseBool(row.is_illuminated),
    latitude:                  parseNum(row.lat),
    longitude:                 parseNum(row.lon),
    base_rate:                 parseNum(row.base_rate),
    biweekly_rate:             parseNum(row.biweekly_rate),
    banda_negativa_enabled:    parseBool(row.banda_negativa_enabled),
    banda_negativa_rate:       parseNum(row.banda_negativa_rate, 0),
    banda_negativa_min_months: parseNum(row.banda_negativa_min_months, 6),
    cost_rent:                 parseNum(row.cost_rent, 0),
    cost_electricity:          parseNum(row.cost_electricity, 0),
    cost_taxes:                parseNum(row.cost_taxes, 0),
    cost_maintenance:          parseNum(row.cost_maintenance, 0),
    cost_imponderables:        parseNum(row.cost_imponderables, 0),
    cost_owner_commission:     parseNum(row.cost_owner_commission, 0),
    cost_print_per_m2:         parseNum(row.cost_print_per_m2, 0),
    cost_installation:         parseNum(row.cost_installation, 0),
    cost_design:               parseNum(row.cost_design, 0),
    cost_seller_commission_pct: parseNum(row.cost_seller_commission_pct, 5),
    cost_agency_commission_pct: parseNum(row.cost_agency_commission_pct, 0),
    cost_owner_commission_pct:  parseNum(row.cost_owner_commission_pct, 0),
  }
}

function escapeCSV(v) {
  const s = String(v ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function buildCSV(items) {
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
  const header = CSV_COLS.join(',')
  const rows   = items.map(item => toRow(item).map(escapeCSV).join(','))
  return '\uFEFF' + [header, ...rows].join('\n') // BOM for Excel
}

// ── Main component ────────────────────────────────────────────

export default function InventoryImportExport({ items, orgName, orgId, onImported, onClose }) {
  const [tab, setTab]             = useState('export')
  const [importing, setImporting] = useState(false)
  const [result, setResult]       = useState(null)  // { updated, inserted, errors[] }
  const fileRef = useRef(null)

  // ── Export ──────────────────────────────────────────────────
  function handleExport() {
    const csv      = buildCSV(items)
    const date     = new Date().toISOString().slice(0, 10)
    const safeName = (orgName ?? 'org').replace(/[^a-z0-9áéíóúñü]/gi, '_')
    const filename = `inventario_${safeName}_${date}.csv`
    const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url      = URL.createObjectURL(blob)
    const a        = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import ──────────────────────────────────────────────────
  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setResult(null)

    try {
      let rows = []

      if (file.name.endsWith('.csv')) {
        const Papa = (await import('papaparse')).default
        rows = await new Promise((resolve, reject) => {
          Papa.parse(file, {
            header:         true,
            skipEmptyLines: true,
            complete: r => resolve(r.data),
            error:    e => reject(e),
          })
        })
      } else if (file.name.match(/\.xlsx?$/i)) {
        const XLSX   = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb     = XLSX.read(buffer, { type: 'array' })
        const ws     = wb.Sheets[wb.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      } else {
        throw new Error('Formato no soportado. Usá CSV o XLSX.')
      }

      // Validar columnas requeridas
      if (rows.length === 0) throw new Error('El archivo está vacío.')
      const headers = Object.keys(rows[0])
      const missing = REQUIRED_COLS.filter(c => !headers.includes(c))
      if (missing.length) throw new Error(`Columnas requeridas faltantes: ${missing.join(', ')}`)

      // Obtener códigos existentes
      const { data: existing } = await supabase
        .from('inventory')
        .select('id, code')
        .eq('org_id', orgId)
      const existingByCode = {}
      ;(existing ?? []).forEach(i => { if (i.code) existingByCode[i.code.toLowerCase()] = i.id })

      // Procesar fila por fila
      const stats = { updated: 0, inserted: 0, errors: [] }

      for (const [idx, row] of rows.entries()) {
        const code = String(row.code ?? '').trim()
        if (!code) {
          stats.errors.push({ row: idx + 2, msg: 'Código vacío — fila omitida' })
          continue
        }

        const payload = rowToPayload(row, orgId)

        // Eliminar campos que pueden no existir en la DB para evitar errores
        if (payload.biweekly_rate == null)           delete payload.biweekly_rate
        if (payload.cost_owner_commission_pct == null) delete payload.cost_owner_commission_pct

        try {
          const existingId = existingByCode[code.toLowerCase()]
          if (existingId) {
            const { error } = await supabase.from('inventory').update(payload).eq('id', existingId)
            if (error) throw error
            stats.updated++
          } else {
            const { error } = await supabase.from('inventory').insert(payload)
            if (error) throw error
            stats.inserted++
          }
        } catch (err) {
          stats.errors.push({ row: idx + 2, msg: err.message })
        }
      }

      setResult(stats)
      if (stats.inserted + stats.updated > 0) onImported()
    } catch (err) {
      setResult({ updated: 0, inserted: 0, errors: [{ row: '—', msg: err.message }] })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-700 px-5 py-4">
          <p className="font-semibold text-white">Importar / Exportar inventario</p>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-700 transition-colors">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-700 px-5">
          {[{ id: 'export', label: 'Exportar CSV' }, { id: 'import', label: 'Importar CSV / Excel' }].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setResult(null) }}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {/* ── Export ── */}
          {tab === 'export' && (
            <>
              <p className="text-sm text-slate-400">
                Descargá un CSV con todos los {items.length} carteles de tu inventario,
                incluyendo costos y configuración. Podés editarlo y reimportarlo.
              </p>
              <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4 text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-400">Columnas incluidas ({CSV_COLS.length}):</p>
                <p className="font-mono leading-relaxed">{CSV_COLS.join(' · ')}</p>
              </div>
              <Button className="w-full" onClick={handleExport}>
                <Download className="h-4 w-4" />
                Descargar CSV ({items.length} carteles)
              </Button>
            </>
          )}

          {/* ── Import ── */}
          {tab === 'import' && (
            <>
              <p className="text-sm text-slate-400">
                Subí un CSV o Excel con tu inventario. Si el código (<code className="text-brand">code</code>) ya existe,
                se actualiza. Si es nuevo, se inserta.
              </p>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300 space-y-1">
                <p className="font-semibold">Columnas requeridas: <span className="font-mono">code, name</span></p>
                <p>El resto es opcional — las columnas vacías mantienen sus valores actuales.</p>
              </div>

              {!importing && !result && (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-700 py-8 text-sm text-slate-500 hover:border-brand/50 hover:text-slate-300 transition-colors">
                  <FileText className="h-8 w-8" />
                  <span>Seleccioná un archivo CSV o XLSX</span>
                  <span className="text-xs text-slate-600">Clic aquí o arrastrá el archivo</span>
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
                      {result.errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-400">
                          <span className="font-mono font-semibold">Fila {e.row}:</span> {e.msg}
                        </p>
                      ))}
                    </div>
                  )}

                  <button type="button" onClick={() => { setResult(null) }}
                    className="w-full rounded-lg border border-surface-700 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                    Importar otro archivo
                  </button>
                </div>
              )}

              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
