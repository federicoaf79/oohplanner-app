import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { generateCertificationPDF } from '../../features/campaigns/generateCertificationPDF'
import {
  ArrowLeft, Camera, Check, Clock, Download, MapPin,
  AlertTriangle, FileText, Calendar, User, RefreshCw,
  ChevronDown, ChevronUp, Maximize2, X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

/* ── Lightbox ──────────────────────────────────────────────── */
function Lightbox({ url, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={url}
        alt="Foto certificación"
        className="max-h-full max-w-full rounded-xl object-contain"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

/* ── SitePhotoCard ─────────────────────────────────────────── */
function SitePhotoCard({ site, photos, onOpenPhoto }) {
  const [expanded, setExpanded] = useState(true)

  const siteName    = site?.name    ?? '—'
  const siteAddress = site?.address ?? '—'
  const siteFormat  = site?.format  ?? ''

  return (
    <div className="rounded-xl border border-surface-700 bg-surface-800/50">
      {/* Cabecera del cartel */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
            photos.length > 0 ? 'bg-brand/15' : 'bg-surface-700'
          }`}>
            {photos.length > 0
              ? <Check className="h-4 w-4 text-brand" />
              : <Camera className="h-4 w-4 text-slate-500" />
            }
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{siteName}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{siteAddress}</span>
              {siteFormat && <span className="ml-1 text-slate-600">· {siteFormat}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            photos.length > 0
              ? 'bg-brand/15 text-brand border-brand/30'
              : 'bg-surface-700 text-slate-500 border-surface-600'
          }`}>
            {photos.length} foto{photos.length !== 1 ? 's' : ''}
          </span>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-slate-600" />
            : <ChevronDown className="h-4 w-4 text-slate-600" />
          }
        </div>
      </button>

      {/* Fotos */}
      {expanded && photos.length > 0 && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {photos.map(photo => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.photo_url}
                  alt=""
                  className="w-full h-28 object-cover rounded-lg border border-surface-600 cursor-pointer"
                  onClick={() => onOpenPhoto(photo.photo_url)}
                />
                <button
                  type="button"
                  onClick={() => onOpenPhoto(photo.photo_url)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
                {photo.taken_at && (
                  <p className="mt-1 text-center text-[10px] text-slate-500">
                    {new Date(photo.taken_at).toLocaleString('es-AR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
          {photos[0]?.notes && (
            <p className="text-xs text-slate-400 rounded-lg bg-surface-700/50 px-3 py-2">
              {photos[0].notes}
            </p>
          )}
        </div>
      )}

      {expanded && photos.length === 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs text-slate-600 italic">Sin fotos cargadas para este cartel.</p>
        </div>
      )}
    </div>
  )
}

/* ── Status badge ──────────────────────────────────────────── */
function StatusBadge({ status }) {
  const cfg = {
    draft: { label: 'Borrador', icon: Clock,  cls: 'bg-surface-700 text-slate-400 border-surface-600' },
    sent:  { label: 'Enviada',  icon: Check,  cls: 'bg-brand/15 text-brand border-brand/30'           },
  }[status] ?? { label: status, icon: Clock, cls: 'bg-surface-700 text-slate-400 border-surface-600' }
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

/* ── Main page ─────────────────────────────────────────────── */
export default function CertificationDetail() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { profile, isOwner, isManager, org } = useAuth()

  const [cert,    setCert]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [markingAsSent, setMarkingAsSent] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  useEffect(() => { loadCert() }, [id])

  // Regenera signed URLs para fotos del bucket privado
  async function refreshPhotoUrls(photos) {
    if (!photos?.length) return photos
    const refreshed = await Promise.all(photos.map(async p => {
      try {
        // Extraer el path desde la URL guardada (busca el segmento después de /certifications/)
        const match = p.photo_url?.match(/certifications\/([^?]+)/)
        if (!match) return p
        const storagePath = match[1]
        const { data } = await supabase.storage
          .from('certifications')
          .createSignedUrl(storagePath, 31536000)
        return data?.signedUrl ? { ...p, photo_url: data.signedUrl } : p
      } catch {
        return p
      }
    }))
    return refreshed
  }

  async function loadCert() {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('campaign_certifications')
      .select(`
        id, status, notes, created_at, updated_at,
        proposal:proposals(
          id, title, client_name, workflow_status, start_date, end_date,
          proposal_items(
            id, site_id,
            site:inventory(id, name, address, format)
          )
        ),
        creator:profiles!created_by(full_name),
        photos:campaign_certification_photos(
          id, site_id, photo_url, taken_at, notes, sort_order
        )
      `)
      .eq('id', id)
      .single()

    if (err) { setError('No se pudo cargar la certificación.'); setLoading(false); return }
    const freshPhotos = await refreshPhotoUrls(data.photos ?? [])
    setCert({ ...data, photos: freshPhotos })
    setLoading(false)
  }

  async function handleDownloadPDF() {
    if (!cert) return
    setGeneratingPDF(true)
    try {
      await generateCertificationPDF({ cert, profile, org, pdfTheme: 'dark' })
    } catch (err) {
      console.error('PDF error:', err)
    } finally {
      setGeneratingPDF(false)
    }
  }

  async function handleMarkAsSent() {
    if (!cert || cert.status === 'sent') return
    setMarkingAsSent(true)
    await supabase.from('campaign_certifications').update({ status: 'sent' }).eq('id', cert.id)
    setCert(prev => ({ ...prev, status: 'sent' }))
    setMarkingAsSent(false)
  }

  /* ── Loading / Error ── */
  if (loading) return (
    <div className="flex items-center justify-center py-24 text-slate-500">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-600 border-t-brand" />
    </div>
  )

  if (error || !cert) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <AlertTriangle className="h-10 w-10 text-slate-700" />
      <p className="text-slate-400">{error || 'Certificación no encontrada.'}</p>
      <button type="button" onClick={() => navigate('/app/certifications')} className="btn-secondary text-sm">
        Volver al listado
      </button>
    </div>
  )

  const proposal = cert.proposal
  const items    = proposal?.proposal_items ?? []
  const photos   = cert.photos ?? []

  /* Agrupar fotos por site_id */
  const photosBySite = photos.reduce((acc, p) => {
    const key = p.site_id ?? '__no_site__'
    ;(acc[key] ??= []).push(p)
    return acc
  }, {})

  const totalPhotos = photos.length
  const certifiedSites = new Set(photos.map(p => p.site_id).filter(Boolean)).size

  /* Fotos sin site_id asignado (edge case) */
  const unsitedPhotos = photosBySite['__no_site__'] ?? []

  return (
    <>
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      <div className="space-y-6 pb-12 max-w-2xl mx-auto">

        {/* ── Back + Header ── */}
        <div>
          <button
            type="button"
            onClick={() => navigate('/app/certifications')}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Certificaciones
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-white">
                {proposal?.client_name ?? 'Certificación'}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {proposal?.title}
              </p>
            </div>
            <StatusBadge status={cert.status} />
          </div>
        </div>

        {/* ── Meta info ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">Fotos</p>
            <p className="text-lg font-bold text-white">{totalPhotos}</p>
            <p className="text-xs text-slate-600">{certifiedSites} cartel{certifiedSites !== 1 ? 'es' : ''}</p>
          </div>
          <div className="rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-3">
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Fecha
            </p>
            <p className="text-sm font-semibold text-white">
              {new Date(cert.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-3">
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <User className="h-3 w-3" /> Creado por
            </p>
            <p className="text-sm font-semibold text-white truncate">
              {cert.creator?.full_name ?? '—'}
            </p>
          </div>
        </div>

        {/* ── Nota general ── */}
        {cert.notes && (
          <div className="rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-3">
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <FileText className="h-3 w-3" /> Nota general
            </p>
            <p className="text-sm text-slate-300">{cert.notes}</p>
          </div>
        )}

        {/* ── Fotos por cartel ── */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Carteles ({items.length})
          </p>
          <div className="space-y-3">
            {items.map(item => (
              <SitePhotoCard
                key={item.id}
                site={item.site}
                photos={photosBySite[item.site_id] ?? []}
                onOpenPhoto={setLightboxUrl}
              />
            ))}
            {/* Edge case: fotos huérfanas sin site_id */}
            {unsitedPhotos.length > 0 && (
              <SitePhotoCard
                site={{ name: 'Sin cartel asignado', address: '' }}
                photos={unsitedPhotos}
                onOpenPhoto={setLightboxUrl}
              />
            )}
          </div>
        </div>

        {/* ── Acciones ── */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">

          {/* Marcar como enviada (solo si está en draft, owner/manager) */}
          {cert.status === 'draft' && (isOwner || isManager) && (
            <button
              type="button"
              onClick={handleMarkAsSent}
              disabled={markingAsSent}
              className="btn-primary flex items-center gap-2"
            >
              {markingAsSent
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Guardando...</>
                : <><Check className="h-4 w-4" /> Marcar como enviada</>
              }
            </button>
          )}

          {/* Descargar PDF — placeholder, sprint siguiente */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
            className="btn-secondary flex items-center gap-2"
          >
            {generatingPDF
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generando...</>
              : <><Download className="h-4 w-4" /> Descargar PDF</>
            }
          </button>

          {/* Link a campaña */}
          {proposal?.id && (
            <Link
              to={`/app/campaigns`}
              className="btn-ghost flex items-center gap-2 text-slate-400"
            >
              <FileText className="h-4 w-4" /> Ver campaña
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
