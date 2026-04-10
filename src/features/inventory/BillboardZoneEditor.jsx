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

const POINT_KEYS = ['tl', 'tr', 'bl', 'br']
const POINT_LABELS = { tl: 'TL', tr: 'TR', bl: 'BL', br: 'BR' }
const POINT_RADIUS = 14

function getPhotoUrl(cara) {
  return cara?.photo_url ?? null
}

function getInitialZone(cara) {
  if (cara?.billboard_zone) return { ...DEFAULT_ZONE, ...cara.billboard_zone }
  return { ...DEFAULT_ZONE }
}

export default function BillboardZoneEditor({ item, caraIndex: initialCaraIndex = 0, onClose, onSaved }) {
  const { profile } = useAuth()
  const orgId = profile?.org_id ?? null

  const caras = Array.isArray(item.caras) && item.caras.length > 0 ? item.caras : [{ id: 'A', label: 'Cara A', photo_url: item.photo_url ?? item.image_url ?? null }]

  const [caraIndex, setCaraIndex] = useState(Math.min(initialCaraIndex, caras.length - 1))
  const [zone, setZone]           = useState(() => getInitialZone(caras[caraIndex]))
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const svgRef      = useRef(null)
  const imgRef      = useRef(null)
  const dragging    = useRef(null)   // { key, startX, startY, origX, origY }
  const photoInputRef = useRef(null)

  // Reset zone when cara changes
  useEffect(() => {
    setZone(getInitialZone(caras[caraIndex]))
    setSaved(false)
    setSaveError('')
  }, [caraIndex]) // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [])

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

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleReset() {
    setZone({ ...DEFAULT_ZONE })
    setSaved(false)
    setSaveError('')
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      const updatedCaras = [...caras]
      updatedCaras[caraIndex] = { ...updatedCaras[caraIndex], billboard_zone: { ...zone } }
      const { error } = await supabase.from('inventory')
        .update({ caras: updatedCaras })
        .eq('id', item.id)
      if (error) throw new Error(error.message)
      setSaved(true)
      onSaved?.({ ...item, caras: updatedCaras })
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePhotoUpload(e) {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    setUploading(true)
    setUploadError('')
    try {
      const cara = caras[caraIndex]
      const caraId = cara?.id ?? 'A'
      const path = `${orgId}/${item.code}_${caraId}.jpg`
      const { error: uploadErr } = await supabase.storage
        .from('inventory-photos')
        .upload(path, f, { upsert: true, contentType: f.type })
      if (uploadErr) throw new Error(uploadErr.message)
      const { data: { publicUrl } } = supabase.storage.from('inventory-photos').getPublicUrl(path)
      const updatedCaras = [...caras]
      updatedCaras[caraIndex] = { ...updatedCaras[caraIndex], photo_url: publicUrl }
      const { error: updateErr } = await supabase.from('inventory')
        .update({ caras: updatedCaras })
        .eq('id', item.id)
      if (updateErr) throw new Error(updateErr.message)
      onSaved?.({ ...item, caras: updatedCaras })
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const currentCara  = caras[caraIndex]
  const photoUrl     = getPhotoUrl(currentCara)
  const { tl, tr, bl, br } = zone

  // SVG polygon points as percentage strings (used in <polygon>)
  const toSvgPt = (pt) => `${(pt.x * 100).toFixed(2)}% ${(pt.y * 100).toFixed(2)}%`
  const polygonPoints = `${toSvgPt(tl)} ${toSvgPt(tr)} ${toSvgPt(br)} ${toSvgPt(bl)}`

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-900 overflow-hidden">

      {/* Header */}
      <div className="shrink-0 border-b border-surface-700 bg-surface-800 px-5 py-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">{item.name}</h2>
          <p className="text-xs text-slate-500">{item.code}{item.address ? ' · ' + item.address : ''}</p>
        </div>

        {/* Cara tabs */}
        {caras.length > 1 && (
          <div className="flex gap-1">
            {caras.map((c, i) => (
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
        <div className="flex-1 flex items-center justify-center bg-black/40 overflow-hidden p-4">
          {photoUrl ? (
            <div className="relative max-w-full max-h-full">
              <img
                ref={imgRef}
                src={photoUrl}
                alt={item.name}
                className="block max-w-full max-h-[70vh] lg:max-h-[80vh] object-contain select-none rounded-lg"
                draggable={false}
              />
              {/* SVG overlay — positioned absolute over the image */}
              <svg
                ref={svgRef}
                className="absolute inset-0 w-full h-full cursor-crosshair"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Shaded area outside zone */}
                <polygon
                  points={polygonPoints}
                  fill="rgba(99,102,241,0.15)"
                  stroke="rgba(99,102,241,0.8)"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Lines connecting corners */}
                {[
                  [tl, tr], [tr, br], [br, bl], [bl, tl],
                  [tl, br], [tr, bl],
                ].map(([a, b], i) => (
                  <line
                    key={i}
                    x1={`${a.x * 100}%`} y1={`${a.y * 100}%`}
                    x2={`${b.x * 100}%`} y2={`${b.y * 100}%`}
                    stroke={i < 4 ? 'rgba(99,102,241,0.9)' : 'rgba(99,102,241,0.25)'}
                    strokeWidth={i < 4 ? '0.5' : '0.3'}
                    strokeDasharray={i >= 4 ? '1 1' : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {/* Draggable corner points */}
                {POINT_KEYS.map(key => {
                  const pt = zone[key]
                  const cx = `${pt.x * 100}%`
                  const cy = `${pt.y * 100}%`
                  return (
                    <g
                      key={key}
                      style={{ cursor: 'grab' }}
                      onMouseDown={e => handleMouseDown(key, e)}
                      onTouchStart={e => handleTouchStart(key, e)}
                    >
                      <circle cx={cx} cy={cy} r={POINT_RADIUS} fill="white" vectorEffect="non-scaling-stroke" />
                      <circle cx={cx} cy={cy} r={POINT_RADIUS - 3} fill="rgb(99,102,241)" vectorEffect="non-scaling-stroke" />
                      <text
                        x={cx} y={cy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="8"
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
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-2xl border-2 border-dashed border-surface-600 p-16">
                <Upload className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <p className="text-sm text-slate-500">Este cartel no tiene foto aún</p>
                <p className="text-xs text-slate-600 mt-1">Subí una imagen para poder marcar la zona</p>
              </div>
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

            {/* Coordinates debug */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Coordenadas actuales</p>
              <div className="grid grid-cols-2 gap-1.5">
                {POINT_KEYS.map(key => (
                  <div key={key} className="rounded-lg bg-surface-700/60 px-2.5 py-1.5">
                    <p className="text-[10px] font-mono text-brand">{POINT_LABELS[key]}</p>
                    <p className="text-[10px] font-mono text-slate-400">
                      {(zone[key].x).toFixed(3)}, {(zone[key].y).toFixed(3)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Upload error */}
            {uploadError && (
              <p className="text-xs text-red-400">{uploadError}</p>
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
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-surface-600 bg-surface-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-surface-600 disabled:opacity-50 transition-colors"
            >
              {uploading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</>
                : <><Upload className="h-4 w-4" /> Cambiar foto</>
              }
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
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
