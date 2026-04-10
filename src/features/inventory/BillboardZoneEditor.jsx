import { useState, useRef, useEffect, useCallback } from 'react'
import { X, RotateCcw, Upload, Save, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const DEFAULT_ZONE = {
  tl: { x: 0.2, y: 0.2 },
  tr: { x: 0.8, y: 0.2 },
  bl: { x: 0.2, y: 0.8 },
  br: { x: 0.8, y: 0.8 },
}

const POINT_KEYS   = ['tl', 'tr', 'bl', 'br']
const POINT_LABELS = { tl: 'TL', tr: 'TR', bl: 'BL', br: 'BR' }
const POINT_RADIUS = 10   // px — pixel-based SVG coords, so this is actual pixels

function initCaras(item) {
  return Array.isArray(item.caras) && item.caras.length > 0
    ? item.caras
    : [{ id: 'A', label: 'Cara A', photo_url: item.photo_url ?? item.image_url ?? null, billboard_zone: null }]
}

function getInitialZone(cara) {
  if (cara?.billboard_zone) return { ...DEFAULT_ZONE, ...cara.billboard_zone }
  return { ...DEFAULT_ZONE }
}

// ── Image compression ────────────────────────────────────────────────────────

function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')

      // Scale down if wider than 1920px
      let { width, height } = img
      if (width > 1920) {
        height = Math.round(height * 1920 / width)
        width  = 1920
      }
      canvas.width  = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Iteratively compress until under 700 KB
      const tryCompress = (q) => {
        canvas.toBlob((blob) => {
          if (blob.size > 700_000 && q > 0.3) {
            tryCompress(q - 0.1)
          } else {
            resolve(blob)
          }
        }, 'image/jpeg', q)
      }
      tryCompress(0.85)
    }
    img.src = url
  })
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BillboardZoneEditor({ item, caraIndex: initialCaraIndex = 0, onClose, onSaved }) {
  const { profile } = useAuth()
  const orgId = profile?.org_id ?? null

  const [localCaras,     setLocalCaras]     = useState(() => initCaras(item))
  const [caraIndex,      setCaraIndex]      = useState(Math.min(initialCaraIndex, initCaras(item).length - 1))
  const [zone,           setZone]           = useState(() => getInitialZone(initCaras(item)[Math.min(initialCaraIndex, initCaras(item).length - 1)]))
  const [saving,         setSaving]         = useState(false)
  const [saved,          setSaved]          = useState(false)
  const [saveError,      setSaveError]      = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError,     setPhotoError]     = useState('')
  const [imgSize,        setImgSize]        = useState({ w: 0, h: 0 })
  const [zoom,           setZoom]           = useState(1)

  const svgRef       = useRef(null)
  const imgRef       = useRef(null)
  const dragging     = useRef(null)
  const photoInputRef = useRef(null)

  // Reset zone + imgSize when cara changes
  useEffect(() => {
    setZone(getInitialZone(localCaras[caraIndex]))
    setSaved(false)
    setSaveError('')
    setImgSize({ w: 0, h: 0 })
  }, [caraIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Capture rendered image dimensions (handles cached images that skip onLoad)
  useEffect(() => {
    const el = imgRef.current
    if (el?.complete && el.clientWidth > 0) {
      setImgSize({ w: el.clientWidth, h: el.clientHeight })
    }
  }, [localCaras, caraIndex])

  // ── Coordinate helpers ────────────────────────────────────────────────────

  function clientToRelative(clientX, clientY) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top)  / rect.height)),
    }
  }

  // ── Mouse drag ────────────────────────────────────────────────────────────

  function handleMouseDown(key, e) {
    e.preventDefault()
    dragging.current = key
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup',   handleMouseUp)
  }

  const handleMouseMove = useCallback((e) => {
    if (!dragging.current) return
    const pos = clientToRelative(e.clientX, e.clientY)
    if (!pos) return
    setZone(prev => ({ ...prev, [dragging.current]: pos }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseUp = useCallback(() => {
    dragging.current = null
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup',   handleMouseUp)
  }, [handleMouseMove])

  useEffect(() => () => {
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup',   handleMouseUp)
  }, [handleMouseMove, handleMouseUp])

  // ── Touch drag ────────────────────────────────────────────────────────────

  function handleTouchStart(key, e) {
    e.preventDefault()
    dragging.current = key
  }

  function handleTouchMove(e) {
    if (!dragging.current) return
    e.preventDefault()
    const touch = e.touches[0]
    const pos = clientToRelative(touch.clientX, touch.clientY)
    if (!pos) return
    setZone(prev => ({ ...prev, [dragging.current]: pos }))
  }

  function handleTouchEnd() {
    dragging.current = null
  }

  // ── Photo upload (with compression) ──────────────────────────────────────

  async function handlePhotoUpload(file) {
    if (!file || !file.type.startsWith('image/')) return
    setPhotoUploading(true)
    setPhotoError('')
    try {
      const compressed = await compressImage(file)
      const currentCara = localCaras[caraIndex]
      const caraId = currentCara?.id ?? 'A'
      const path = `${orgId}/${item.code}_${caraId}.jpg`

      const { error: uploadErr } = await supabase.storage
        .from('inventory-photos')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: true })
      if (uploadErr) throw new Error(uploadErr.message)

      const { data: { publicUrl } } = supabase.storage.from('inventory-photos').getPublicUrl(path)

      const updatedCaras = [...localCaras]
      if (updatedCaras[caraIndex]) {
        updatedCaras[caraIndex] = { ...updatedCaras[caraIndex], photo_url: publicUrl }
      } else {
        updatedCaras.push({ id: caraId, label: 'Cara A', photo_url: publicUrl, billboard_zone: null })
      }

      await supabase.from('inventory')
        .update({ caras: updatedCaras, photo_url: publicUrl })
        .eq('id', item.id)

      setLocalCaras(updatedCaras)
      onSaved?.({ ...item, caras: updatedCaras })
    } catch (err) {
      setPhotoError(err.message)
    } finally {
      setPhotoUploading(false)
    }
  }

  function handlePhotoDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handlePhotoUpload(file)
  }

  // ── Save zone ─────────────────────────────────────────────────────────────

  function handleReset() {
    setZone({ ...DEFAULT_ZONE })
    setSaved(false)
    setSaveError('')
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      const updatedCaras = [...localCaras]
      updatedCaras[caraIndex] = { ...updatedCaras[caraIndex], billboard_zone: { ...zone } }
      const { error } = await supabase.from('inventory')
        .update({ caras: updatedCaras })
        .eq('id', item.id)
      if (error) throw new Error(error.message)
      setLocalCaras(updatedCaras)
      setSaved(true)
      onSaved?.({ ...item, caras: updatedCaras })
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const currentCara = localCaras[caraIndex]
  const photoUrl    = currentCara?.photo_url ?? null
  const { tl, tr, bl, br } = zone

  // Pixel-based SVG coordinates (viewBox = actual rendered image px dimensions)
  const W = imgSize.w || 1
  const H = imgSize.h || 1
  const px  = (pt) => pt.x * W
  const py  = (pt) => pt.y * H
  const polygonPoints = `${px(tl)},${py(tl)} ${px(tr)},${py(tr)} ${px(br)},${py(br)} ${px(bl)},${py(bl)}`

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-900 overflow-hidden">

      {/* Header */}
      <div className="shrink-0 border-b border-surface-700 bg-surface-800 px-5 py-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">{item.name}</h2>
          <p className="text-xs text-slate-500">{item.code}{item.address ? ' · ' + item.address : ''}</p>
        </div>

        {/* Cara tabs */}
        {localCaras.length > 1 && (
          <div className="flex gap-1">
            {localCaras.map((c, i) => (
              <button
                key={c.id ?? i}
                onClick={() => setCaraIndex(i)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  caraIndex === i
                    ? 'bg-brand text-white'
                    : 'bg-surface-700 text-slate-400 hover:text-white'
                }`}
              >
                {c.label ?? `Cara ${c.id ?? i + 1}`}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-surface-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* Image + SVG overlay */}
        <div className="flex-1 flex items-center justify-center bg-black/40 p-4 relative"
          style={{ overflow: zoom > 1 ? 'auto' : 'hidden' }}>
          {photoUrl ? (
            <>
              {/* Zoom controls — vertical, Google Maps style */}
              <div className="absolute bottom-4 right-4 flex flex-col items-center z-10
                              rounded-lg overflow-hidden shadow-lg border border-white/10">
                <button
                  onClick={() => setZoom(z => Math.min(3, z + 0.5))}
                  className="w-9 h-9 flex items-center justify-center text-lg font-bold
                             bg-surface-800 text-white hover:bg-surface-700 transition-colors
                             border-b border-white/10"
                >
                  +
                </button>
                <div className="w-9 h-8 flex items-center justify-center
                                bg-surface-800 text-white text-xs font-bold
                                border-b border-white/10 select-none">
                  {zoom}x
                </div>
                <button
                  onClick={() => setZoom(z => Math.max(1, z - 0.5))}
                  className="w-9 h-9 flex items-center justify-center text-lg font-bold
                             bg-surface-800 text-white hover:bg-surface-700 transition-colors"
                >
                  −
                </button>
              </div>

              {zoom > 1 && (
                <button
                  onClick={() => setZoom(1)}
                  className="absolute bottom-4 right-16 z-10 px-2 py-1 rounded-lg text-xs
                             font-bold bg-surface-800 text-white hover:bg-surface-700
                             border border-white/10 shadow-lg transition-colors"
                >
                  Reset
                </button>
              )}

              {/* Scaled image + SVG container */}
              <div
                className="relative"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  ...(zoom > 1 ? {} : { maxWidth: '100%', maxHeight: '100%' }),
                }}
              >
                <img
                  ref={imgRef}
                  src={photoUrl}
                  alt={item.name}
                  className="block max-w-full max-h-[70vh] lg:max-h-[80vh] object-contain select-none rounded-lg"
                  draggable={false}
                  onLoad={e => setImgSize({ w: e.target.clientWidth, h: e.target.clientHeight })}
                />
                {/* SVG overlay — pixel-based viewBox matches rendered image dimensions */}
                {imgSize.w > 0 && (
                  <svg
                    ref={svgRef}
                    className="absolute inset-0 w-full h-full"
                    viewBox={`0 0 ${W} ${H}`}
                    preserveAspectRatio="none"
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    {/* Polygon: yellow stroke, translucent gray fill — drawn under points */}
                    <polygon
                      points={polygonPoints}
                      fill="rgba(100,100,100,0.45)"
                      stroke="#FACC15"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* Draggable corner points */}
                    {POINT_KEYS.map(key => {
                      const pt = zone[key]
                      const cx = px(pt)
                      const cy = py(pt)
                      return (
                        <g
                          key={key}
                          style={{ cursor: 'crosshair' }}
                          onMouseDown={e => handleMouseDown(key, e)}
                          onTouchStart={e => handleTouchStart(key, e)}
                        >
                          {/* Transparent circle with white border */}
                          <circle
                            cx={cx} cy={cy} r={POINT_RADIUS}
                            fill="transparent"
                            stroke="#ffffff"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                          {/* Center dot */}
                          <circle
                            cx={cx} cy={cy} r={2}
                            fill="#FACC15"
                            vectorEffect="non-scaling-stroke"
                          />
                          <text
                            x={cx} y={cy - POINT_RADIUS - 4}
                            textAnchor="middle"
                            dominantBaseline="auto"
                            fontSize="9"
                            fontWeight="bold"
                            fill="white"
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                          >
                            {POINT_LABELS[key]}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                )}
              </div>
            </>
          ) : (
            /* No-photo placeholder — accepts drop + click */
            <div
              onDrop={handlePhotoDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => photoInputRef.current?.click()}
              style={{ cursor: 'pointer' }}
              className="rounded-2xl border-2 border-dashed border-surface-600 p-16 text-center hover:border-brand/40 hover:bg-surface-800/50 transition-colors select-none"
            >
              {photoUploading ? (
                <>
                  <Loader2 className="mx-auto h-12 w-12 text-brand animate-spin mb-3" />
                  <p className="text-sm text-slate-400">Subiendo y comprimiendo foto…</p>
                </>
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                  <p className="text-sm text-slate-400 font-medium">Arrastrá una foto aquí o hacé clic</p>
                  <p className="text-xs text-slate-600 mt-1">JPG · PNG · WEBP · se comprime automáticamente</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="shrink-0 lg:w-72 border-t lg:border-t-0 lg:border-l border-surface-700 bg-surface-800 flex flex-col">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Instrucciones</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Arrastrá los 4 puntos (<span className="font-mono text-slate-400">TL TR BL BR</span>) hasta las esquinas de la superficie del cartel para generar mockups de campaña.
              </p>
            </div>

            {/* Coordinates */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Coordenadas actuales</p>
              <div className="grid grid-cols-2 gap-1.5">
                {POINT_KEYS.map(key => (
                  <div key={key} className="rounded-lg bg-surface-700/60 px-2.5 py-1.5">
                    <p className="text-[10px] font-mono text-brand">{POINT_LABELS[key]}</p>
                    <p className="text-[10px] font-mono text-slate-400">
                      {zone[key].x.toFixed(3)}, {zone[key].y.toFixed(3)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Photo uploading spinner */}
            {photoUploading && (
              <div className="flex items-center gap-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2">
                <Loader2 className="h-4 w-4 text-brand animate-spin shrink-0" />
                <p className="text-xs text-brand">Subiendo foto…</p>
              </div>
            )}

            {/* Photo error */}
            {photoError && (
              <p className="text-xs text-red-400">{photoError}</p>
            )}

            {/* Save error */}
            {saveError && (
              <p className="text-xs text-red-400">{saveError}</p>
            )}

            {/* Success */}
            {saved && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-400">Zona guardada</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="shrink-0 border-t border-surface-700 p-4 space-y-2">
            <button
              type="button"
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-surface-600 bg-surface-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-surface-600 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Resetear
            </button>

            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-surface-600 bg-surface-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-surface-600 disabled:opacity-50 transition-colors"
            >
              {photoUploading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</>
                : <><Upload className="h-4 w-4" /> Cambiar foto</>
              }
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { handlePhotoUpload(e.target.files?.[0]); e.target.value = '' }}
            />

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !photoUrl}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
                : <><Save className="h-4 w-4" /> Guardar zona</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
