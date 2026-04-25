import { useState } from 'react'
import { Upload } from 'lucide-react'
import { validateArtwork } from '../../lib/validateArtwork'
import { useAuth } from '../../context/AuthContext'

const SLOT_SPECS = {
  h:  { px: '1920 × 1080 px', ratio: '16:9', peso: 'Máx 5 MB' },
  v:  { px: '1080 × 1920 px', ratio: '9:16', peso: 'Máx 5 MB' },
  sq: { px: '1080 × 1080 px', ratio: '1:1',  peso: 'Máx 5 MB' },
}

const SLOTS = [
  { key: 'h',  label: 'Horizontal', aspect: '16:9', ratio: 'aspect-video' },
  { key: 'v',  label: 'Vertical',   aspect: '9:16', ratio: 'aspect-[9/16]' },
  { key: 'sq', label: 'Cuadrado',   aspect: '1:1',  ratio: 'aspect-square' },
]

/**
 * Grilla de 3 slots (H/V/Sq) para subir artes del cliente. Reutilizado entre
 * el Step 1 del Wizard (campo "Arte del cliente") y el Step 3 (panel "Artes
 * para mockup"). El state vive en el contenedor (ProposalNew) para que ambos
 * pasos compartan los archivos.
 *
 * Props:
 * - clientArtH/V/Sq + setters: state del contenedor con forma { file, preview } | null
 * - showOrgFallback: si true, muestra el fallback de empresa cuando el slot está vacío
 */
export default function ClientArtworkSlots({
  clientArtH, setClientArtH,
  clientArtV, setClientArtV,
  clientArtSq, setClientArtSq,
  showOrgFallback = true,
}) {
  const { org } = useAuth()
  const [error, setError] = useState(null)

  const setters = { h: setClientArtH, v: setClientArtV, sq: setClientArtSq }
  const states  = { h: clientArtH,    v: clientArtV,    sq: clientArtSq }
  const orgFallbacks = {
    h: org?.artwork_h_url,
    v: org?.artwork_v_url,
    sq: org?.artwork_sq_url,
  }

  async function handleArt(slot, file) {
    if (!file) return
    setError(null)

    const result = await validateArtwork(file, slot)
    if (!result.valid) {
      setError({ slot, message: result.error })
      return
    }

    const previous = states[slot]
    if (previous?.preview) URL.revokeObjectURL(previous.preview)

    const preview = URL.createObjectURL(file)
    setters[slot]({ file, preview })
  }

  function removeArt(slot) {
    setError(null)
    const current = states[slot]
    if (current?.preview) URL.revokeObjectURL(current.preview)
    setters[slot](null)
  }

  return (
    <>
      {error && (
        <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
          <svg className="h-4 w-4 text-red-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs text-red-300 leading-relaxed">{error.message}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {SLOTS.map(slot => {
          const state       = states[slot.key]
          const orgFallback = showOrgFallback ? orgFallbacks[slot.key] : null
          const spec        = SLOT_SPECS[slot.key]

          return (
            <div key={slot.key} className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-slate-400 text-center">{slot.label} ({slot.aspect})</p>

              {state ? (
                /* Arte del cliente subido */
                <div className="relative rounded-lg overflow-hidden border border-brand/40 bg-surface-700">
                  <div className={`${slot.ratio} w-full`}>
                    <img src={state.preview} alt={slot.label}
                      className="absolute inset-0 w-full h-full object-cover" />
                  </div>
                  <button type="button" onClick={() => removeArt(slot.key)}
                    className="absolute top-1 right-1 rounded-full bg-slate-900/80 p-0.5 text-slate-400 hover:text-red-400 transition-colors">
                    <span className="sr-only">Quitar</span>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                  <div className="absolute bottom-1 left-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Cliente
                  </div>
                </div>
              ) : orgFallback ? (
                /* Fallback de empresa */
                <label className="cursor-pointer">
                  <div className="relative rounded-lg overflow-hidden border border-surface-600 bg-surface-700 opacity-70 hover:opacity-100 transition-opacity">
                    <div className={`${slot.ratio} w-full`}>
                      <img src={orgFallback} alt={slot.label}
                        className="absolute inset-0 w-full h-full object-cover" />
                    </div>
                    <div className="absolute bottom-1 left-1 rounded bg-surface-800/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                      Empresa
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                      <Upload className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <input type="file" accept="image/jpeg,image/png" className="hidden"
                    onChange={e => { handleArt(slot.key, e.target.files?.[0]); e.target.value = '' }} />
                </label>
              ) : (
                /* Sin arte — specs recomendadas */
                <label className="cursor-pointer">
                  <div className={`${slot.ratio} w-full rounded-lg border-2 border-dashed border-surface-600 bg-surface-800/30 flex flex-col items-center justify-center gap-2 p-2 hover:border-brand/40 transition-colors text-center`}>
                    <Upload className="h-4 w-4 text-slate-500" />
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-medium text-slate-400 leading-tight">{spec.px}</p>
                      <p className="text-[10px] text-slate-600 leading-tight">{spec.ratio} · {spec.peso}</p>
                    </div>
                    <span className="text-[10px] text-brand font-medium">Subir</span>
                  </div>
                  <input type="file" accept="image/jpeg,image/png" className="hidden"
                    onChange={e => { handleArt(slot.key, e.target.files?.[0]); e.target.value = '' }} />
                </label>
              )}

              {/* Botón cambiar si hay arte de cliente */}
              {state && (
                <label className="cursor-pointer text-center">
                  <span className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">Cambiar</span>
                  <input type="file" accept="image/jpeg,image/png" className="hidden"
                    onChange={e => { handleArt(slot.key, e.target.files?.[0]); e.target.value = '' }} />
                </label>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
