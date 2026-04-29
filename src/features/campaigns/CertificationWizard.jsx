import { useState, useRef } from 'react'
import { Camera, Upload, X, Check, RefreshCw, AlertTriangle, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

async function extractExifDate(file) {
  try {
    const buffer = await file.arrayBuffer()
    const bytes  = new Uint8Array(buffer)
    const text   = new TextDecoder('ascii', { fatal: false }).decode(bytes.slice(0, 65536))
    const match  = text.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
    if (match) {
      const [, y, mo, d, h, mi, s] = match
      return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`)
    }
  } catch {}
  return null
}

function formatLocalDatetime(date) {
  if (!date) return ''
  const d = new Date(date)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function SitePhotoSlot({ site, photos, onPhotosChange }) {
  const inputRef = useRef()
  const { profile } = useAuth()

  async function handleFiles(files) {
    if (!files?.length) return
    const newPhotos = []
    for (const file of Array.from(files).slice(0, 3 - photos.length)) {
      if (!file.type.startsWith('image/')) continue
      const exifDate = await extractExifDate(file)
      const takenAt  = exifDate ?? new Date()
      const preview  = URL.createObjectURL(file)
      newPhotos.push({ file, preview, taken_at: formatLocalDatetime(takenAt), siteNote: '', url: null })
    }
    onPhotosChange(site.site_id, [...photos, ...newPhotos])
  }

  const siteName    = site?.site?.name    ?? site?.site_name    ?? 'Cartel'
  const siteAddress = site?.site?.address ?? site?.site_address ?? '—'

  return (
    <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-white text-sm truncate">{siteName}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" />{siteAddress}
          </p>
        </div>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${
          photos.length > 0
            ? 'bg-brand/15 text-brand border-brand/30'
            : 'bg-surface-700 text-slate-500 border-surface-600'
        }`}>
          {photos.length} foto{photos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {photos.map((p, idx) => (
            <div key={idx} className="relative group">
              <img src={p.preview} alt="" className="w-full h-24 object-cover rounded-lg border border-surface-600" />
              <button
                type="button"
                onClick={() => onPhotosChange(site.site_id, photos.filter((_, i) => i !== idx))}
                className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
              <input
                type="datetime-local"
                value={p.taken_at}
                onChange={e => onPhotosChange(site.site_id, photos.map((ph, i) => i === idx ? { ...ph, taken_at: e.target.value } : ph))}
                className="mt-1 w-full rounded bg-surface-700 border border-surface-600 px-1.5 py-0.5 text-[10px] text-slate-300"
              />
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <textarea
          placeholder="Nota del cartel (opcional)..."
          rows={2}
          value={photos[0]?.siteNote ?? ''}
          onChange={e => onPhotosChange(site.site_id, photos.map((p, i) => i === 0 ? { ...p, siteNote: e.target.value } : p))}
          className="w-full rounded-lg bg-surface-700 border border-surface-600 px-3 py-2 text-xs text-slate-300 placeholder-slate-600 resize-none mb-2"
        />
      )}

      {photos.length < 3 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-surface-600 py-2.5 text-xs text-slate-400 hover:border-brand/40 hover:text-brand transition-colors"
        >
          <Camera className="h-3.5 w-3.5" />
          {photos.length === 0 ? 'Subir fotos del cartel' : 'Agregar foto'}
          <span className="text-slate-600">({3 - photos.length} restantes)</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple capture="environment"
        className="hidden" onChange={e => handleFiles(e.target.files)} />
    </div>
  )
}

export default function CertificationWizard({ campaign, onClose, onDone }) {
  const { profile } = useAuth()
  const [step, setStep]           = useState('photos')
  const [sitePhotos, setSitePhotos] = useState({})
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState('')
  const [globalNote, setGlobalNote] = useState('')

  const items          = campaign.proposal_items ?? []
  const totalPhotos    = Object.values(sitePhotos).reduce((s, a) => s + a.length, 0)
  const sitesWithPhotos = Object.values(sitePhotos).filter(a => a.length > 0).length

  function handlePhotosChange(siteId, photos) {
    setSitePhotos(prev => ({ ...prev, [siteId]: photos }))
  }

  async function handleSave() {
    if (totalPhotos === 0) return
    setSaving(true)
    setSaveError('')
    try {
      const orgId = profile.org_id

      const { data: cert, error: certErr } = await supabase
        .from('campaign_certifications')
        .upsert({
          org_id:      orgId,
          proposal_id: campaign.id,
          created_by:  profile.id,
          status:      'draft',
          notes:       globalNote || null,
        }, { onConflict: 'proposal_id' })
        .select('id')
        .single()
      if (certErr) throw new Error(certErr.message)

      const cid = cert.id
      const photoRows = []
      let sortOrder = 0

      for (const [siteId, photos] of Object.entries(sitePhotos)) {
        for (const photo of photos) {
          if (!photo.file) continue
          const ext  = photo.file.name.split('.').pop() ?? 'jpg'
          const path = `${orgId}/${cid}/${siteId}_${Date.now()}_${sortOrder}.${ext}`

          const { error: uploadErr } = await supabase.storage
            .from('certifications')
            .upload(path, photo.file, { upsert: true })
          if (uploadErr) throw new Error(uploadErr.message)

          const { data: urlData } = supabase.storage.from('certifications').getPublicUrl(path)

          photoRows.push({
            certification_id: cid,
            site_id:          siteId || null,
            photo_url:        urlData.publicUrl ?? path,
            taken_at:         photo.taken_at ? new Date(photo.taken_at).toISOString() : new Date().toISOString(),
            notes:            photo.siteNote || null,
            sort_order:       sortOrder++,
          })
        }
      }

      if (photoRows.length > 0) {
        const { error: photosErr } = await supabase.from('campaign_certification_photos').insert(photoRows)
        if (photosErr) throw new Error(photosErr.message)
      }

      await supabase.from('campaign_certifications').update({ status: 'sent' }).eq('id', cid)

      setStep('done')
      onDone?.()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="py-6 text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/20">
            <Check className="h-8 w-8 text-brand" />
          </div>
        </div>
        <div>
          <p className="font-bold text-white text-lg">Certificacion guardada</p>
          <p className="text-sm text-slate-400 mt-1">
            {totalPhotos} foto{totalPhotos !== 1 ? 's' : ''} de {sitesWithPhotos} cartel{sitesWithPhotos !== 1 ? 'es' : ''} registradas.
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-primary px-8 py-2.5">Cerrar</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold text-white">Certificacion de campana</p>
        <p className="text-xs text-slate-400 mt-1">
          Subi las fotos de cada cartel instalado. El sistema detecta la fecha y hora automaticamente del EXIF de la imagen.
        </p>
      </div>

      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {items.map(item => (
          <SitePhotoSlot
            key={item.id}
            site={item}
            photos={sitePhotos[item.site_id] ?? []}
            onPhotosChange={handlePhotosChange}
          />
        ))}
      </div>

      <textarea
        placeholder="Nota general de la certificacion (opcional)..."
        rows={2}
        value={globalNote}
        onChange={e => setGlobalNote(e.target.value)}
        className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 resize-none"
      />

      {totalPhotos > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-brand/10 border border-brand/20 px-4 py-2.5 text-sm text-brand">
          <Check className="h-4 w-4 shrink-0" />
          {totalPhotos} foto{totalPhotos !== 1 ? 's' : ''} de {sitesWithPhotos} cartel{sitesWithPhotos !== 1 ? 'es' : ''}
        </div>
      )}

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />{saveError}
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 rounded-xl border border-surface-700 py-2.5 text-sm text-slate-400 hover:bg-surface-800 transition-colors">
          Cancelar
        </button>
        <button type="button" onClick={handleSave} disabled={totalPhotos === 0 || saving}
          className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
          {saving
            ? <><RefreshCw className="h-4 w-4 animate-spin" /> Guardando...</>
            : <><Upload className="h-4 w-4" /> Guardar certificacion</>
          }
        </button>
      </div>
    </div>
  )
}
