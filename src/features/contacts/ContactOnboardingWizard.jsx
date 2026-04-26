import { useState, useCallback, useRef } from 'react'
import {
  X, Upload, FileSpreadsheet, AlertTriangle, Check,
  ChevronRight, ChevronLeft, RefreshCw, Users, SkipForward
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { CONTACT_ROLES, ROLE_LABEL_MAP, ROLES_BY_CATEGORY } from '../../lib/contactRoles'

// ─── Mapeo automático de nombres de columna → campo del schema ──────────────
const AUTO_MAP = {
  'nombre': 'name', 'name': 'name', 'empresa': 'name', 'compañia': 'name',
  'company': 'name', 'cliente': 'name', 'denominacion': 'name',
  'razon social': 'legal_name', 'razón social': 'legal_name',
  'legal name': 'legal_name', 'denominación social': 'legal_name',
  'denominacion social': 'legal_name', 'legal_name': 'legal_name',
  'cuit': 'tax_id', 'cuil': 'tax_id', 'cuit/cuil': 'tax_id',
  'tax id': 'tax_id', 'nro cuit': 'tax_id', 'numero cuit': 'tax_id',
  'email': 'email', 'mail': 'email', 'correo': 'email', 'e-mail': 'email',
  'email empresa': 'email', 'mail empresa': 'email',
  'telefono': 'phone', 'teléfono': 'phone', 'tel': 'phone', 'phone': 'phone',
  'fono': 'phone', 'celular': 'phone', 'movil': 'phone', 'móvil': 'phone',
  'whatsapp': 'whatsapp', 'wsp': 'whatsapp', 'ws': 'whatsapp',
  'web': 'website', 'website': 'website', 'sitio': 'website', 'url': 'website',
  'pagina web': 'website', 'página web': 'website',
  'direccion': 'address', 'dirección': 'address', 'address': 'address',
  'domicilio': 'address', 'calle': 'address',
  'ciudad': 'city', 'city': 'city', 'localidad': 'city', 'partido': 'city',
  'provincia': 'province', 'province': 'province',
  'rol': 'roles', 'role': 'roles', 'roles': 'roles', 'tipo': 'roles',
  'rubro': 'roles', 'categoria': 'roles', 'categoría': 'roles', 'tipo contacto': 'roles',
  'contacto': 'contact_person_name', 'contact': 'contact_person_name',
  'responsable': 'contact_person_name', 'nombre contacto': 'contact_person_name',
  'persona de contacto': 'contact_person_name', 'referente': 'contact_person_name',
  'cargo': 'contact_person_role', 'puesto': 'contact_person_role',
  'cargo contacto': 'contact_person_role', 'rol contacto': 'contact_person_role',
  'email contacto': 'contact_person_email', 'mail contacto': 'contact_person_email',
  'telefono contacto': 'contact_person_phone', 'tel contacto': 'contact_person_phone',
  'notas': 'notes', 'notes': 'notes', 'observaciones': 'notes',
  'comentarios': 'notes', 'descripcion': 'notes',
}

const SCHEMA_FIELDS = [
  { id: '__ignore__',           label: '— Ignorar columna —' },
  { id: 'name',                 label: 'Nombre / Empresa *', required: true },
  { id: 'legal_name',           label: 'Razón social' },
  { id: 'tax_id',               label: 'CUIT / CUIL' },
  { id: 'email',                label: 'Email empresa' },
  { id: 'phone',                label: 'Teléfono' },
  { id: 'whatsapp',             label: 'WhatsApp' },
  { id: 'website',              label: 'Sitio web' },
  { id: 'address',              label: 'Dirección' },
  { id: 'city',                 label: 'Ciudad' },
  { id: 'province',             label: 'Provincia' },
  { id: 'roles',                label: 'Roles (columna del archivo)' },
  { id: 'contact_person_name',  label: 'Nombre del contacto' },
  { id: 'contact_person_role',  label: 'Cargo del contacto' },
  { id: 'contact_person_email', label: 'Email del contacto' },
  { id: 'contact_person_phone', label: 'Teléfono del contacto' },
  { id: 'notes',                label: 'Notas' },
]

function normalize(str) {
  return String(str ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function autoDetect(columns) {
  const mapping = {}
  columns.forEach(col => {
    const key = normalize(col)
    mapping[col] = AUTO_MAP[key] ?? '__ignore__'
  })
  return mapping
}

async function parseFile(file) {
  const XLSXmod = await import('xlsx')
  const XLSX = XLSXmod.default ?? XLSXmod

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        let rows
        if (file.name.endsWith('.csv')) {
          const text = new TextDecoder('utf-8').decode(e.target.result)
          const wb = XLSX.read(text, { type: 'string' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        } else {
          const wb = XLSX.read(e.target.result, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        }
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    if (file.name.endsWith('.csv')) {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsArrayBuffer(file)
    }
  })
}

// ─── Extraer roles de un string libre ────────────────────────────────────────
const ROLE_ALIASES = {}
CONTACT_ROLES.forEach(r => {
  ROLE_ALIASES[normalize(r.id)] = r.id
  ROLE_ALIASES[normalize(r.label)] = r.id
})
// aliases comunes adicionales
const EXTRA = {
  'anunciante': 'advertiser', 'agencia': 'agency', 'facilitador': 'facilitator',
  'impresor': 'printer', 'colocador': 'installer', 'propietario': 'landlord',
  'proveedor': 'supplier', 'municipio': 'municipality', 'contador': 'accountant',
  'abogado': 'lawyer', 'multimedio': 'media_group', 'vendedor externo': 'external_seller',
}
Object.assign(ROLE_ALIASES, Object.fromEntries(
  Object.entries(EXTRA).map(([k, v]) => [normalize(k), v])
))

function parseRoleValue(val) {
  if (!val) return []
  return String(val).split(/[,;|\/]/).map(v => {
    const key = normalize(v)
    return ROLE_ALIASES[key] ?? null
  }).filter(Boolean)
}

// ─── Componentes internos ─────────────────────────────────────────────────────

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full transition-all ${
            i < current ? 'bg-blue-500' :
            i === current ? 'bg-blue-400 ring-2 ring-blue-400/30' :
            'bg-surface-600'
          }`} />
        </div>
      ))}
    </div>
  )
}

// ─── PASO 1: Upload ───────────────────────────────────────────────────────────
function Step1Upload({ onParsed }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file) return
    const ok = /\.(xlsx|xls|csv)$/i.test(file.name)
    if (!ok) { setError('Formato no soportado. Usá .xlsx, .xls o .csv'); return }
    setError(null)
    setLoading(true)
    try {
      const rows = await parseFile(file)
      if (rows.length === 0) throw new Error('El archivo está vacío o no tiene datos.')
      onParsed({ file, rows, columns: Object.keys(rows[0]) })
    } catch (e) {
      setError(e.message ?? 'Error al leer el archivo.')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Importar contactos</h2>
        <p className="mt-1 text-sm text-slate-400">
          Subí tu lista en formato Excel (.xlsx) o CSV. El wizard va a guiarte
          para mapear las columnas a los campos del sistema.
        </p>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-blue-500/10' : 'border-surface-600 hover:border-surface-500 bg-surface-800/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={e => handleFile(e.target.files[0])}
        />
        {loading ? (
          <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
        ) : (
          <FileSpreadsheet className="h-10 w-10 text-slate-500" />
        )}
        <div className="text-center">
          <p className="font-medium text-slate-300">
            {loading ? 'Leyendo archivo…' : 'Arrastrá tu archivo acá'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            o hacé clic para seleccionar · .xlsx .xls .csv
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-lg bg-surface-800 border border-surface-700 p-4 text-xs text-slate-400 space-y-1">
        <p className="font-medium text-slate-300 mb-2">¿Qué columnas puede tener tu archivo?</p>
        <p>Nombre / Empresa · Razón social · CUIT · Email · Teléfono · WhatsApp</p>
        <p>Dirección · Ciudad · Provincia · Rol / Tipo · Contacto principal · Cargo</p>
        <p>Email contacto · Tel contacto · Notas</p>
        <p className="text-slate-500 mt-2">No hace falta que tengas todas — el wizard ignora lo que no encuentre.</p>
      </div>
    </div>
  )
}

// ─── PASO 2: Mapeo de columnas ────────────────────────────────────────────────
function Step2Mapping({ columns, rows, mapping, setMapping }) {
  const sample = rows.slice(0, 3)

  function usedFields() {
    return Object.values(mapping).filter(v => v !== '__ignore__')
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Mapear columnas</h2>
        <p className="mt-1 text-sm text-slate-400">
          Revisá que cada columna de tu archivo esté asignada al campo correcto.
          El sistema detectó algunas automáticamente.
        </p>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {columns.map(col => {
          const sampleVals = sample.map(r => r[col]).filter(Boolean).join(' · ')
          const isDuplicate = mapping[col] !== '__ignore__' &&
            Object.entries(mapping).filter(([k, v]) => k !== col && v === mapping[col]).length > 0

          return (
            <div key={col} className={`rounded-lg border p-3 ${
              isDuplicate ? 'border-amber-500/30 bg-amber-500/5' : 'border-surface-700 bg-surface-800'
            }`}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-200 truncate">{col}</p>
                  {sampleVals && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{sampleVals}</p>
                  )}
                </div>
                <select
                  value={mapping[col] ?? '__ignore__'}
                  onChange={e => setMapping(m => ({ ...m, [col]: e.target.value }))}
                  className="input-field w-52 shrink-0 text-sm"
                >
                  {SCHEMA_FIELDS.map(f => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              {isDuplicate && (
                <p className="text-xs text-amber-400 mt-1">
                  ⚠ Este campo ya está asignado a otra columna
                </p>
              )}
            </div>
          )
        })}
      </div>

      {!Object.values(mapping).includes('name') && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Necesitás asignar al menos la columna <strong>Nombre / Empresa</strong>
        </div>
      )}
    </div>
  )
}

// ─── PASO 3: Roles ────────────────────────────────────────────────────────────
function Step3Roles({ rows, mapping, roleMap, setRoleMap, defaultRoles, setDefaultRoles }) {
  const hasRolesColumn = Object.values(mapping).includes('roles')
  const rolesColName = Object.entries(mapping).find(([, v]) => v === 'roles')?.[0]

  // Valores únicos encontrados en la columna de roles del archivo
  const uniqueRoleValues = hasRolesColumn
    ? [...new Set(rows.map(r => String(r[rolesColName] ?? '')).filter(Boolean))]
    : []

  function toggleDefaultRole(roleId) {
    setDefaultRoles(prev =>
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    )
  }

  if (hasRolesColumn) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Mapear roles</h2>
          <p className="mt-1 text-sm text-slate-400">
            Tu archivo tiene una columna de roles. Asigná cada valor a un rol del sistema.
          </p>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {uniqueRoleValues.map(val => (
            <div key={val} className="flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-800 p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">"{val}"</p>
                <p className="text-xs text-slate-500">
                  {rows.filter(r => r[rolesColName] === val).length} contactos
                </p>
              </div>
              <select
                value={roleMap[val] ?? '__ignore__'}
                onChange={e => setRoleMap(m => ({ ...m, [val]: e.target.value }))}
                className="input-field w-52 shrink-0 text-sm"
              >
                <option value="__ignore__">— Ignorar —</option>
                {ROLES_BY_CATEGORY.map(cat => (
                  <optgroup key={cat.id} label={cat.label}>
                    {cat.roles.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Sin columna de roles → asignar rol por defecto a todos
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Asignar roles</h2>
        <p className="mt-1 text-sm text-slate-400">
          No encontramos columna de roles. Elegí qué rol(es) asignarle a todos
          los contactos importados. Podés cambiarlos uno a uno después.
        </p>
      </div>
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {ROLES_BY_CATEGORY.map(cat => (
          <div key={cat.id}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5"
               style={{ color: cat.color }}>{cat.label}</p>
            <div className="flex flex-wrap gap-2">
              {cat.roles.map(role => {
                const active = defaultRoles.includes(role.id)
                return (
                  <button
                    key={role.id}
                    onClick={() => toggleDefaultRole(role.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      active
                        ? 'text-white'
                        : 'bg-surface-700 text-slate-400 hover:bg-surface-600'
                    }`}
                    style={active ? { background: cat.color } : {}}
                  >
                    {role.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {defaultRoles.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Sin roles asignados. Los contactos se importarán sin clasificación.
        </div>
      )}
    </div>
  )
}

// ─── PASO 4: Preview + Import ─────────────────────────────────────────────────
function Step4Preview({ mapped, existingContacts, conflicts, setConflicts, onImport, importing, importResult }) {
  const newCount = mapped.filter(r => !conflicts[r.__key__] || conflicts[r.__key__] === 'update').length
  const skipCount = Object.values(conflicts).filter(v => v === 'skip').length
  const updateCount = Object.values(conflicts).filter(v => v === 'update').length
  const conflictKeys = new Set(Object.keys(conflicts))

  if (importResult) {
    return (
      <div className="space-y-5 text-center py-4">
        <div className="flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20">
            <Check className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">¡Importación completada!</h2>
          <p className="mt-2 text-slate-400">
            <span className="text-blue-400 font-semibold">{importResult.inserted}</span> contactos nuevos ·{' '}
            <span className="text-slate-300 font-semibold">{importResult.updated}</span> actualizados ·{' '}
            <span className="text-slate-500 font-semibold">{importResult.skipped}</span> salteados
          </p>
          {importResult.errors > 0 && (
            <p className="mt-1 text-xs text-red-400">{importResult.errors} errores</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Vista previa</h2>
        <p className="mt-1 text-sm text-slate-400">
          Revisá los datos antes de importar. Los contactos con{' '}
          <span className="text-amber-400">⚠</span> ya existen en el sistema.
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 rounded-lg bg-surface-800 border border-surface-700 p-3 text-sm">
        <span className="text-slate-400">
          <span className="font-semibold text-white">{mapped.length - Object.keys(conflicts).length}</span> nuevos
        </span>
        {Object.keys(conflicts).length > 0 && (
          <>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400">
              <span className="font-semibold">{updateCount}</span> a actualizar
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">
              <span className="font-semibold">{skipCount}</span> a saltear
            </span>
          </>
        )}
      </div>

      {/* Table */}
      <div className="max-h-72 overflow-y-auto rounded-xl border border-surface-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-700 bg-surface-800">
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Nombre</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium hidden sm:table-cell">CUIT</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium hidden sm:table-cell">Roles</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium w-28">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-700">
            {mapped.map((row, i) => {
              const isConflict = conflictKeys.has(row.__key__)
              const action = conflicts[row.__key__]
              return (
                <tr key={i} className={isConflict ? 'bg-amber-500/5' : ''}>
                  <td className="px-3 py-2 text-slate-200 font-medium">{row.name || '—'}</td>
                  <td className="px-3 py-2 text-slate-400 hidden sm:table-cell font-mono">{row.tax_id || '—'}</td>
                  <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">
                    {(row.roles ?? []).map(r => ROLE_LABEL_MAP[r] ?? r).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2">
                    {isConflict ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => setConflicts(c => ({ ...c, [row.__key__]: 'update' }))}
                          className={`rounded px-2 py-0.5 text-xs transition-colors ${
                            action === 'update'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-surface-700 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          Actualizar
                        </button>
                        <button
                          onClick={() => setConflicts(c => ({ ...c, [row.__key__]: 'skip' }))}
                          className={`rounded px-2 py-0.5 text-xs transition-colors ${
                            action === 'skip'
                              ? 'bg-surface-600 text-slate-400'
                              : 'bg-surface-700 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          Saltear
                        </button>
                      </div>
                    ) : (
                      <span className="text-blue-400">Nuevo</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={onImport}
        disabled={importing}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {importing ? (
          <><RefreshCw className="h-4 w-4 animate-spin" /> Importando…</>
        ) : (
          <><Upload className="h-4 w-4" /> Importar {mapped.length - skipCount} contactos</>
        )}
      </button>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ContactOnboardingWizard({ existingContacts = [], onClose, onDone }) {
  const { profile } = useAuth()
  const [step, setStep]             = useState(0)  // 0=upload 1=mapping 2=roles 3=preview
  const [fileData, setFileData]     = useState(null)  // { file, rows, columns }
  const [mapping, setMapping]       = useState({})    // { colName: fieldId }
  const [roleMap, setRoleMap]       = useState({})    // { rawValue: roleId } cuando hay col de roles
  const [defaultRoles, setDefaultRoles] = useState([]) // roles por defecto si no hay col
  const [conflicts, setConflicts]   = useState({})    // { key: 'update'|'skip' }
  const [importing, setImporting]   = useState(false)
  const [importResult, setImportResult] = useState(null)

  // Paso 1 → 2
  function handleParsed(data) {
    setFileData(data)
    setMapping(autoDetect(data.columns))
    setStep(1)
  }

  // Aplicar mapping a filas → array de objetos contact
  function applyMapping() {
    const hasRolesCol = Object.values(mapping).includes('roles')
    const rolesColName = Object.entries(mapping).find(([, v]) => v === 'roles')?.[0]

    return fileData.rows.map(row => {
      const contact = {}
      Object.entries(mapping).forEach(([col, field]) => {
        if (field === '__ignore__' || field === 'roles') return
        const val = String(row[col] ?? '').trim()
        if (val) contact[field] = val
      })

      // Roles
      if (hasRolesCol && rolesColName) {
        const rawVal = String(row[rolesColName] ?? '')
        // primero intentar mapeo manual del usuario
        const mapped = roleMap[rawVal]
        if (mapped && mapped !== '__ignore__') {
          contact.roles = [mapped]
        } else {
          // fallback: parse automático
          contact.roles = parseRoleValue(rawVal)
        }
      } else {
        contact.roles = [...defaultRoles]
      }

      // Clave de dedup: tax_id o email
      contact.__key__ = contact.tax_id || contact.email || null
      return contact
    }).filter(c => c.name) // descartar filas sin nombre
  }

  // Paso 2 → 3
  function goToRoles() {
    if (!Object.values(mapping).includes('name')) return
    setStep(2)
  }

  // Paso 3 → 4: calcular duplicados
  function goToPreview() {
    const mapped = applyMapping()
    const existingKeys = new Set([
      ...existingContacts.map(c => c.tax_id).filter(Boolean),
      ...existingContacts.map(c => c.email).filter(Boolean),
    ])
    const initial = {}
    mapped.forEach(row => {
      if (row.__key__ && existingKeys.has(row.__key__)) {
        initial[row.__key__] = 'update'
      }
    })
    setConflicts(initial)
    setStep(3)
  }

  async function handleImport() {
    setImporting(true)
    const mapped = applyMapping()
    let inserted = 0, updated = 0, skipped = 0, errors = 0
    const newContacts = []

    for (const row of mapped) {
      const { __key__, ...contact } = row
      contact.org_id = profile.org_id
      contact.created_by = profile.id

      try {
        if (__key__ && conflicts[__key__] === 'skip') {
          skipped++
          continue
        }

        if (__key__ && conflicts[__key__] === 'update') {
          // encontrar el existente
          const existing = existingContacts.find(
            c => c.tax_id === __key__ || c.email === __key__
          )
          if (existing) {
            const { data, error } = await supabase
              .from('contacts')
              .update(contact)
              .eq('id', existing.id)
              .select()
              .single()
            if (error) { errors++; continue }
            newContacts.push(data)
            updated++
            continue
          }
        }

        // INSERT
        const { data, error } = await supabase
          .from('contacts')
          .insert(contact)
          .select()
          .single()
        if (error) { errors++; continue }
        newContacts.push(data)
        inserted++
      } catch {
        errors++
      }
    }

    setImportResult({ inserted, updated, skipped, errors })
    setImporting(false)
    if (inserted + updated > 0) onDone(newContacts)
  }

  const STEPS = ['Archivo', 'Columnas', 'Roles', 'Importar']
  const mapped = step === 3 ? applyMapping() : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-surface-900 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-400" />
            <div>
              <p className="font-semibold text-white">Importar contactos</p>
              <p className="text-xs text-slate-500">{STEPS[step]} · Paso {step + 1} de {STEPS.length}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-surface-700 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b border-surface-700">
          {STEPS.map((label, i) => (
            <div
              key={i}
              className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${
                i === step ? 'text-blue-400 border-b-2 border-blue-400' :
                i < step ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 0 && <Step1Upload onParsed={handleParsed} />}

          {step === 1 && fileData && (
            <>
              <Step2Mapping
                columns={fileData.columns}
                rows={fileData.rows}
                mapping={mapping}
                setMapping={setMapping}
              />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(0)} className="btn-secondary flex items-center gap-2">
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </button>
                <button
                  onClick={goToRoles}
                  disabled={!Object.values(mapping).includes('name')}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Step3Roles
                rows={fileData.rows}
                mapping={mapping}
                roleMap={roleMap}
                setRoleMap={setRoleMap}
                defaultRoles={defaultRoles}
                setDefaultRoles={setDefaultRoles}
              />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-2">
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </button>
                <button
                  onClick={goToPreview}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  Ver preview <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <Step4Preview
              mapped={mapped}
              existingContacts={existingContacts}
              conflicts={conflicts}
              setConflicts={setConflicts}
              onImport={handleImport}
              importing={importing}
              importResult={importResult}
            />
          )}

          {step === 3 && importResult && (
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="btn-primary w-full">
                Cerrar
              </button>
            </div>
          )}

          {step === 3 && !importResult && (
            <div className="flex justify-start mt-2">
              <button onClick={() => setStep(2)} className="btn-secondary flex items-center gap-2 text-sm">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
