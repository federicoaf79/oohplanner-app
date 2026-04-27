import { useState, useRef } from 'react'
import {
  X, Upload, FileSpreadsheet, AlertTriangle, Check,
  RefreshCw, Users, Sparkles, Info, Mail
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

// ─── Schema fields ────────────────────────────────────────────
const SCHEMA_FIELDS = ['full_name', 'email', 'role', 'commission_pct', 'supervisor_name', '__ignore__']

const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', salesperson: 'Vendedor' }
const ROLE_PILL  = {
  owner:       'bg-brand/15 text-brand border border-brand/30',
  manager:     'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  salesperson: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
}

// ─── Fallback mapeo sin IA ────────────────────────────────────
const AUTO_MAP = {
  'nombre': 'full_name', 'name': 'full_name', 'full_name': 'full_name',
  'apellido y nombre': 'full_name', 'apellido nombre': 'full_name',
  'vendedor': 'full_name', 'agente': 'full_name', 'empleado': 'full_name',
  'email': 'email', 'mail': 'email', 'correo': 'email', 'e-mail': 'email',
  'correo electronico': 'email', 'correo electrónico': 'email',
  'rol': 'role', 'role': 'role', 'cargo': 'role', 'puesto': 'role',
  'perfil': 'role', 'tipo': 'role', 'nivel': 'role',
  'comision': 'commission_pct', 'comisión': 'commission_pct',
  'commission': 'commission_pct', 'pct': 'commission_pct',
  'porcentaje': 'commission_pct', '% comision': 'commission_pct',
  '% comisión': 'commission_pct', 'comision pct': 'commission_pct',
  'supervisor': 'supervisor_name', 'jefe': 'supervisor_name',
  'responsable': 'supervisor_name', 'reporta a': 'supervisor_name',
  'gerente': 'supervisor_name', 'lider': 'supervisor_name', 'líder': 'supervisor_name',
}

function normalize(str) {
  return String(str ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeRole(val) {
  const v = normalize(val)
  if (['owner', 'dueño', 'dueno', 'propietario'].includes(v)) return 'owner'
  if (['manager', 'gerente', 'jefe', 'director', 'supervisor'].includes(v)) return 'manager'
  if (['salesperson', 'vendedor', 'venta', 'agente', 'comercial'].includes(v)) return 'salesperson'
  return null
}

// ─── Parser ───────────────────────────────────────────────────
async function parseSpreadsheet(file) {
  const XLSXmod = await import('xlsx')
  const XLSX = XLSXmod.default ?? XLSXmod
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 })
  if (!raw.length) throw new Error('El archivo está vacío.')

  // Detectar fila de headers
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(raw.length, 5); i++) {
    if (raw[i].filter(v => v !== '' && v != null).length >= 2) {
      headerRowIdx = i; break
    }
  }
  const headers = raw[headerRowIdx].map((h, i) => String(h ?? '').trim() || `Col_${i + 1}`)
  return {
    rows: raw.slice(headerRowIdx + 1)
      .filter(row => row.some(v => v !== '' && v != null))
      .map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))),
    sheetNames: wb.SheetNames,
  }
}

// ─── AI mapping ───────────────────────────────────────────────
async function aiMapColumns(columns, sampleRows) {
  const samples = columns.slice(0, 20).map(col => {
    const vals = sampleRows.map(r => String(r[col] ?? '')).filter(Boolean).slice(0, 3)
    return `"${col}": [${vals.map(v => `"${v.slice(0, 30)}"`).join(', ')}]`
  }).join('\n')

  const prompt = `Mapeá columnas de una planilla de equipo comercial.

Schema válido: full_name, email, role, commission_pct, supervisor_name, __ignore__

Reglas:
- Nombre de la persona → full_name
- Email de contacto → email
- Cargo/puesto/nivel → role (valores posibles: owner, manager, salesperson)
- Porcentaje de comisión → commission_pct
- Nombre del supervisor/jefe directo → supervisor_name
- Número correlativo, fecha, teléfono, dirección → __ignore__

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
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    const validIds = new Set(SCHEMA_FIELDS)
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

// ─── Aplicar mapping ──────────────────────────────────────────
function applyMapping(rows, mapping) {
  return rows.map(row => {
    const m = {}
    Object.entries(mapping).forEach(([col, field]) => {
      if (field === '__ignore__') return
      const val = String(row[col] ?? '').trim()
      if (val) m[field] = val
    })
    // Normalizar role
    if (m.role) m.role = normalizeRole(m.role) ?? 'salesperson'
    // Normalizar commission_pct
    if (m.commission_pct) {
      const n = parseFloat(String(m.commission_pct).replace('%', '').replace(',', '.'))
      m.commission_pct = isNaN(n) ? 0 : n
    } else {
      m.commission_pct = 0
    }
    m.__key__ = (m.email ?? '').toLowerCase().trim()
    return m
  }).filter(r => r.email && r.email.includes('@'))
}

// ─── Resolver supervisor_id por nombre ───────────────────────
function resolveSupervisors(mapped, existingMembers) {
  // Construir mapa nombre → id de existentes + nuevos importados
  const nameMap = {}
  existingMembers.forEach(m => {
    if (m.full_name) nameMap[normalize(m.full_name)] = m.id
  })
  return mapped.map(row => {
    if (!row.supervisor_name) return row
    const key = normalize(row.supervisor_name)
    const supervisorId = nameMap[key] ?? null
    return { ...row, supervisor_id: supervisorId, _supervisorResolved: !!supervisorId }
  })
}

// ─── Componente principal ─────────────────────────────────────
export default function TeamOnboardingWizard({ existingMembers = [], onClose, onDone }) {
  const { profile } = useAuth()
  const [step, setStep]               = useState('upload') // upload | confirm
  const [mapped, setMapped]           = useState([])
  const [analyzing, setAnalyzing]     = useState(false)
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [error, setError]             = useState(null)
  const inputRef = useRef()
  const [dragging, setDragging]       = useState(false)

  const existingEmails = new Set(existingMembers.map(m => (m.email ?? '').toLowerCase()))

  async function handleFile(file) {
    if (!file) return
    if (!/\.(xlsx|xls|csv|ods)$/i.test(file.name)) {
      setError('Formato no soportado. Usá .xlsx, .xls, .csv u .ods')
      return
    }
    setError(null)
    setAnalyzing(true)
    try {
      const { rows } = await parseSpreadsheet(file)
      if (!rows.length) throw new Error('El archivo no tiene datos.')
      const columns = Object.keys(rows[0])
      const mapping = await aiMapColumns(columns, rows.slice(0, 8))
      let result = applyMapping(rows, mapping)
      result = resolveSupervisors(result, existingMembers)
      if (!result.length) throw new Error('No se encontraron filas con email válido.')
      setMapped(result)
      setStep('confirm')
    } catch (e) {
      setError(e.message ?? 'Error al procesar el archivo.')
    }
    setAnalyzing(false)
  }

  async function handleImport() {
    setImporting(true)
    let invited = 0, updated = 0, errors = 0, skipped = 0
    const resultMembers = []

    // Ordenar: primero los sin supervisor (o con supervisor ya existente),
    // después los que tienen supervisor nuevo del mismo import
    const existingEmailSet = new Set(existingMembers.map(m => (m.email ?? '').toLowerCase()))

    for (const row of mapped) {
      const { __key__, supervisor_name, _supervisorResolved, ...data } = row
      const isExisting = existingEmailSet.has(__key__)

      try {
        if (isExisting) {
          // Actualizar perfil existente
          const existing = existingMembers.find(m => (m.email ?? '').toLowerCase() === __key__)
          if (!existing) { skipped++; continue }
          const patch = {}
          if (data.full_name) patch.full_name = data.full_name
          if (data.role && data.role !== existing.role) patch.role = data.role
          if (data.commission_pct > 0) patch.commission_pct = data.commission_pct
          if (data.supervisor_id) patch.supervisor_id = data.supervisor_id

          if (Object.keys(patch).length > 0) {
            const { error } = await supabase.from('profiles').update(patch).eq('id', existing.id)
            if (error) { errors++; continue }
            resultMembers.push({ ...existing, ...patch })
            updated++
          } else {
            skipped++
          }
        } else {
          // Invitar nuevo miembro via Edge Function
          const body = {
            email: data.email,
            role: data.role ?? 'salesperson',
            full_name: data.full_name ?? '',
          }
          const { error } = await supabase.functions.invoke('invite-member', { body })
          if (error) {
            // Rate limit u otros errores
            console.warn('invite-member error:', error.message)
            errors++
            continue
          }
          resultMembers.push({ email: data.email, full_name: data.full_name, role: data.role })
          invited++
        }
      } catch (e) {
        console.warn('Import error:', e)
        errors++
      }
    }

    setImportResult({ invited, updated, skipped, errors })
    setImporting(false)
    if (invited + updated > 0) onDone(resultMembers)
  }

  // ─── Step Upload ──────────────────────────────────────────
  if (step === 'upload') {
    return (
      <Modal onClose={onClose} title="Importar equipo" subtitle="Subir archivo">
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Importar equipo</h2>
            <p className="mt-1 text-sm text-slate-400">
              Subí tu lista de vendedores y gerentes. La IA detecta las columnas automáticamente.
            </p>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
            onClick={() => !analyzing && inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors ${
              analyzing  ? 'border-blue-400/50 bg-blue-500/5 cursor-default' :
              dragging   ? 'border-blue-400 bg-blue-500/10 cursor-copy' :
              'border-surface-600 hover:border-surface-500 bg-surface-800/50 cursor-pointer'
            }`}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.ods"
              className="hidden" onChange={e => handleFile(e.target.files[0])} />
            {analyzing ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
                  <Sparkles className="h-7 w-7 text-blue-400 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-slate-200">Analizando archivo…</p>
                  <p className="mt-1 text-xs text-slate-500">La IA está detectando las columnas</p>
                </div>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-10 w-10 text-slate-500" />
                <div className="text-center">
                  <p className="font-medium text-slate-300">Arrastrá tu archivo acá</p>
                  <p className="mt-1 text-xs text-slate-500">o hacé clic para seleccionar</p>
                  <p className="mt-2 text-xs text-slate-600">.xlsx · .xls · .csv · .ods</p>
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
            <div>
              <span className="font-medium text-slate-300">Columnas detectadas automáticamente:</span>{' '}
              Nombre · Email · Rol · % Comisión · Supervisor
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  // ─── Step Confirm ─────────────────────────────────────────
  const newCount      = mapped.filter(r => !existingEmails.has(r.__key__)).length
  const updateCount   = mapped.filter(r =>  existingEmails.has(r.__key__)).length
  const supervisorCount = mapped.filter(r => r.supervisor_name).length
  const unresolved    = mapped.filter(r => r.supervisor_name && !r._supervisorResolved).length

  if (importResult) {
    return (
      <Modal onClose={onClose} title="Importar equipo" subtitle="Completado">
        <div className="space-y-6 py-4 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20">
              <Check className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">¡Importación completada!</h2>
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm">
              {importResult.invited > 0 && (
                <span className="text-slate-400">
                  <span className="text-blue-400 font-semibold text-base">{importResult.invited}</span> invitaciones enviadas
                </span>
              )}
              {importResult.updated > 0 && (
                <span className="text-slate-400">
                  <span className="text-slate-300 font-semibold text-base">{importResult.updated}</span> actualizados
                </span>
              )}
              {importResult.skipped > 0 && (
                <span className="text-slate-400">
                  <span className="text-slate-500 font-semibold text-base">{importResult.skipped}</span> sin cambios
                </span>
              )}
            </div>
            {importResult.errors > 0 && (
              <p className="mt-2 text-xs text-amber-400">
                {importResult.errors} errores — revisá el límite diario de invitaciones (máx. 20/día)
              </p>
            )}
            {importResult.invited > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                Los nuevos miembros van a recibir un email con el link de activación.
              </p>
            )}
          </div>
          <button onClick={onClose} className="btn-primary w-full">Cerrar</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} title="Importar equipo" subtitle="Confirmar importación">
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Listo para importar</h2>
          <p className="mt-1 text-sm text-slate-400">Revisá el resumen antes de confirmar.</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-800 border border-surface-700 p-4 text-center">
            <p className="text-2xl font-bold text-white">{newCount}</p>
            <p className="text-xs text-slate-400 mt-1">Invitaciones a enviar</p>
          </div>
          <div className="rounded-xl bg-surface-800 border border-surface-700 p-4 text-center">
            <p className="text-2xl font-bold text-white">{updateCount}</p>
            <p className="text-xs text-slate-400 mt-1">Miembros a actualizar</p>
          </div>
          {supervisorCount > 0 && (
            <div className={`rounded-xl border p-4 text-center col-span-2 ${
              unresolved > 0
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-surface-800 border-surface-700'
            }`}>
              <p className={`text-lg font-bold ${unresolved > 0 ? 'text-amber-400' : 'text-white'}`}>
                {supervisorCount - unresolved} / {supervisorCount}
              </p>
              <p className={`text-xs mt-1 ${unresolved > 0 ? 'text-amber-400/70' : 'text-slate-400'}`}>
                Supervisores resueltos
                {unresolved > 0 && ` · ${unresolved} no encontrado${unresolved > 1 ? 's' : ''}`}
              </p>
            </div>
          )}
        </div>

        {unresolved > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              {unresolved} supervisor{unresolved > 1 ? 'es' : ''} no coinciden con ningún miembro del equipo.
              Se importan igual — podés asignarlos manualmente después desde Ajustes.
            </span>
          </div>
        )}

        {/* Preview */}
        <div className="rounded-xl border border-surface-700 overflow-hidden">
          <div className="px-4 py-2 bg-surface-800 border-b border-surface-700">
            <p className="text-xs text-slate-400 font-medium">
              Vista previa · primeros {Math.min(mapped.length, 6)} de {mapped.length}
            </p>
          </div>
          <div className="divide-y divide-surface-700">
            {mapped.slice(0, 6).map((m, i) => {
              const isNew = !existingEmails.has(m.__key__)
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {m.full_name || m.email}
                      </p>
                      {m.role && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${ROLE_PILL[m.role] ?? ROLE_PILL.salesperson}`}>
                          {ROLE_LABEL[m.role] ?? m.role}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{m.email}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isNew
                      ? <><Mail className="h-3 w-3 text-blue-400" /><span className="text-xs text-blue-400">Invitar</span></>
                      : <span className="text-xs text-slate-500">Actualizar</span>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <button
          onClick={handleImport}
          disabled={importing}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          {importing
            ? <><RefreshCw className="h-4 w-4 animate-spin" /> Importando…</>
            : <><Upload className="h-4 w-4" /> Importar {mapped.length} miembros</>
          }
        </button>

        <button
          onClick={() => setStep('upload')}
          className="w-full text-center text-xs text-slate-500 hover:text-slate-400 transition-colors"
        >
          ← Subir otro archivo
        </button>
      </div>
    </Modal>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────
function Modal({ children, onClose, title, subtitle }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-surface-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-400" />
            <div>
              <p className="font-semibold text-white">{title}</p>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-surface-700 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
