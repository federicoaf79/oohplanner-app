import { useState, useRef } from 'react'
import { X, Image, CheckCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'

const BUCKET = 'inventory-photos'

// Normaliza string para comparación: minúsculas, sin tildes, sin caracteres raros
function normalize(str) {
  return (str ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

// Intenta hacer match entre el nombre de archivo y un item del inventario
function matchItem(basename, itemsByCode, itemsByNormAddr) {
  const norm = normalize(basename)

  // 1. Match exacto por código
  if (itemsByCode[norm]) return itemsByCode[norm]

  // 2. Match por dirección normalizada (contiene el nombre del archivo)
  for (const [addr, item] of Object.entries(itemsByNormAddr)) {
    if (addr.includes(norm) || norm.includes(addr)) return item
  }

  return null
}

export default function InventoryPhotosUpload({ items, orgId, onDone, onClose }) {
  const [status,   setStatus]   = useState('idle')   // idle | processing | done
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' })
  const [result,   setResult]   = useState(null)     // { assigned, unmatched[] }
  const fileRef = useRef(null)

  // Construir índices de búsqueda
  const buildIndexes = () => {
    const byCode     = {}
    const byNormAddr = {}
    items.forEach(item => {
      if (item.code)    byCode[normalize(item.code)]    = item
      if (item.name)    byCode[normalize(item.name)]    = item
      if (item.address) byNormAddr[normalize(item.address)] = item
    })
    return { byCode, byNormAddr }
  }

  async function handleZipUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('processing')
    setResult(null)

    try {
      const JSZip = (await import('jszip')).default
      const zip   = await JSZip.loadAsync(file)

      // Filtrar solo imágenes
      const imageEntries = Object.entries(zip.files).filter(([name, f]) =>
        !f.dir && /\.(jpe?g|png|webp)$/i.test(name)
      )

      if (imageEntries.length === 0) {
        throw new Error('El ZIP no contiene imágenes JPG, PNG o WEBP.')
      }

      const { byCode, byNormAddr } = buildIndexes()
      const stats = { assigned: 0, unmatched: [] }

      for (const [idx, [fullPath, zipFile]] of imageEntries.entries()) {
        const filename = fullPath.split('/').pop()
        const basename = filename.replace(/\.[^.]+$/, '')
        const ext      = filename.split('.').pop().toLowerCase()
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`

        setProgress({ current: idx + 1, total: imageEntries.length, label: filename })

        const matched = matchItem(basename, byCode, byNormAddr)

        if (!matched) {
          stats.unmatched.push(filename)
          continue
        }

        // Subir a Supabase Storage
        const blob       = await zipFile.async('blob')
        const storagePath = `${orgId}/${matched.id}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, blob, { contentType: mimeType, upsert: true })

        if (uploadErr) {
          stats.unmatched.push(`${filename} (error: ${uploadErr.message})`)
          continue
        }

        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(storagePath)

        await supabase.from('inventory')
          .update({ photo_url: publicUrl })
          .eq('id', matched.id)

        stats.assigned++
      }

      setResult(stats)
      setStatus('done')
      if (stats.assigned > 0) onDone()
    } catch (err) {
      setResult({ assigned: 0, unmatched: [`Error: ${err.message}`] })
      setStatus('done')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={status !== 'processing' ? onClose : undefined} />

      <div className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-700 px-5 py-4">
          <div>
            <p className="font-semibold text-white">Carga masiva de fotos</p>
            <p className="text-xs text-slate-500">{items.length} carteles en inventario</p>
          </div>
          {status !== 'processing' && (
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-700 transition-colors">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Instrucciones */}
          {status === 'idle' && (
            <>
              <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4 space-y-3 text-sm text-slate-400">
                <p className="font-semibold text-white">Reglas de nomenclatura del ZIP</p>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex gap-2">
                    <span className="text-brand font-mono shrink-0">Por código:</span>
                    <span>El nombre del archivo debe ser el código del cartel<br/>
                      <span className="text-slate-500">Ej: <code>CAB001.jpg</code>, <code>MDP-05.png</code></span>
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand font-mono shrink-0">Por nombre:</span>
                    <span>O el nombre exacto del cartel<br/>
                      <span className="text-slate-500">Ej: <code>Corrientes 3500.jpg</code></span>
                    </span>
                  </li>
                </ul>
                <div className="border-t border-surface-700 pt-3 text-xs text-slate-500 space-y-1">
                  <p>📐 <strong className="text-slate-400">Formato:</strong> JPG o PNG</p>
                  <p>📦 <strong className="text-slate-400">Tamaño máximo por imagen:</strong> 2 MB</p>
                  <p>🖼️ <strong className="text-slate-400">Resolución recomendada:</strong> 1200 × 800 px</p>
                  <p>🪣 <strong className="text-slate-400">Bucket Supabase:</strong> <code>inventory-photos</code> (debe existir y ser público)</p>
                </div>
              </div>

              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-700 py-8 text-sm text-slate-500 hover:border-brand/50 hover:text-slate-300 transition-colors">
                <Image className="h-8 w-8" />
                <span>Seleccioná el archivo ZIP</span>
                <span className="text-xs text-slate-600">Clic aquí para elegir el ZIP con las fotos</span>
              </button>
            </>
          )}

          {/* Procesando */}
          {status === 'processing' && (
            <div className="py-6 space-y-4">
              <div className="flex items-center justify-center gap-3">
                <Spinner size="lg" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">
                  Procesando imagen {progress.current} de {progress.total}
                </p>
                <p className="text-xs text-slate-500 mt-1 font-mono truncate">{progress.label}</p>
              </div>
              <div className="w-full rounded-full bg-surface-700 h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-brand transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Resultado */}
          {status === 'done' && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 text-center">
                  <CheckCircle className="h-6 w-6 text-teal-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-teal-400">{result.assigned}</p>
                  <p className="text-xs text-slate-500">Fotos asignadas</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                  <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-amber-400">{result.unmatched.length}</p>
                  <p className="text-xs text-slate-500">Sin coincidencia</p>
                </div>
              </div>

              {result.unmatched.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-surface-700 bg-surface-800/50 p-3 space-y-1">
                  <p className="text-xs font-medium text-slate-400 mb-2">Sin coincidencia:</p>
                  {result.unmatched.map((name, i) => (
                    <p key={i} className="text-xs text-slate-500 font-mono">{name}</p>
                  ))}
                </div>
              )}

              <button type="button" onClick={() => { setStatus('idle'); setResult(null) }}
                className="w-full rounded-lg border border-surface-700 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                Subir otro ZIP
              </button>
            </div>
          )}

          <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={handleZipUpload} />
        </div>
      </div>
    </div>
  )
}
