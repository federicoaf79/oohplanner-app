import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Camera, Search, ChevronRight, Check, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import CertificationWizard from '../../features/campaigns/CertificationWizard'

export default function Certifications() {
  const { profile, isOwner, isManager, isSalesperson } = useAuth()
  const [certs, setCerts]         = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showNew, setShowNew]     = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)

  useEffect(() => {
    if (!profile?.org_id) return
    loadData()
  }, [profile?.org_id])

  async function loadData() {
    setLoading(true)
    const orgId = profile.org_id

    // Cargar certificaciones existentes
    let certQuery = supabase
      .from('campaign_certifications')
      .select(`
        id, status, notes, created_at, updated_at,
        proposal:proposals(id, title, client_name, created_by),
        creator:profiles!created_by(full_name),
        photos:campaign_certification_photos(id, site_id, photo_url, taken_at)
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    // Cargar campañas disponibles para certificar
    let campQuery = supabase
      .from('proposals')
      .select('id, title, client_name, created_by, proposal_items(id, site_id, site:inventory(id, name, address))')
      .eq('org_id', orgId)
      .eq('status', 'accepted')
      .not('workflow_status', 'is', null)
      .order('created_at', { ascending: false })

    if (isSalesperson) {
      certQuery  = certQuery.eq('created_by', profile.id)
      campQuery  = campQuery.eq('created_by', profile.id)
    }

    const [{ data: certData }, { data: campData }] = await Promise.all([certQuery, campQuery])
    setCerts(certData ?? [])
    setCampaigns(campData ?? [])
    setLoading(false)
  }

  const filtered = certs.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.proposal?.title?.toLowerCase().includes(q) ||
      c.proposal?.client_name?.toLowerCase().includes(q)
    )
  })

  // Campañas sin certificación aún
  const certifiedProposalIds = new Set(certs.map(c => c.proposal?.id).filter(Boolean))
  const pendingCampaigns = campaigns.filter(c => !certifiedProposalIds.has(c.id))

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Certificaciones</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Registra la instalacion de cada campana con fotos y fecha
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" /> Nueva certificacion
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar por cliente o campaña..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-9 w-full max-w-md"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-brand" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* Campañas pendientes de certificar */}
          {pendingCampaigns.length > 0 && !search && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                Pendientes de certificar ({pendingCampaigns.length})
              </p>
              <div className="space-y-2">
                {pendingCampaigns.slice(0, 5).map(c => (
                  <div key={c.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-3 hover:border-brand/30 transition-colors cursor-pointer"
                    onClick={() => { setSelectedCampaign(c); setShowNew(true) }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{c.client_name}</p>
                      <p className="text-xs text-slate-500 truncate">{c.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-500">{c.proposal_items?.length ?? 0} carteles</span>
                      <Camera className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certificaciones existentes */}
          {filtered.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                Certificaciones generadas ({filtered.length})
              </p>
              <div className="space-y-2">
                {filtered.map(cert => (
                  <Link
                    key={cert.id}
                    to={`/app/certifications/${cert.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-3 hover:border-brand/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                        cert.status === 'sent' ? 'bg-brand/15' : 'bg-surface-700'
                      }`}>
                        {cert.status === 'sent'
                          ? <Check className="h-4 w-4 text-brand" />
                          : <Clock className="h-4 w-4 text-slate-500" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {cert.proposal?.client_name ?? '—'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {cert.proposal?.title} · {cert.photos?.length ?? 0} fotos · {cert.creator?.full_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-500">
                        {new Date(cert.created_at).toLocaleDateString('es-AR')}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Camera className="h-10 w-10 text-slate-700 mb-3" />
              <p className="text-slate-400 font-medium">No hay certificaciones aun</p>
              <p className="text-slate-600 text-sm mt-1">
                {search ? 'No se encontraron resultados.' : 'Crea la primera certificacion de una campana activa.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal: Nueva certificación */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl bg-surface-900 border border-surface-700 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-surface-700">
              <div>
                <p className="font-bold text-white">Nueva certificacion</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedCampaign ? selectedCampaign.client_name : 'Selecciona una campana'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowNew(false); setSelectedCampaign(null) }}
                className="rounded-lg p-1 text-slate-500 hover:bg-surface-700 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              {/* Selector de campaña si no viene pre-seleccionada */}
              {!selectedCampaign ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-400">Selecciona la campana a certificar:</p>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {pendingCampaigns.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCampaign(c)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-surface-700 px-4 py-3 text-left hover:border-brand/40 hover:bg-surface-800/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{c.client_name}</p>
                          <p className="text-xs text-slate-500 truncate">{c.title} · {c.proposal_items?.length ?? 0} carteles</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
                      </button>
                    ))}
                    {pendingCampaigns.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-8">
                        Todas las campanas activas ya tienen certificacion.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <CertificationWizard
                  campaign={selectedCampaign}
                  onClose={() => { setShowNew(false); setSelectedCampaign(null) }}
                  onDone={() => { setShowNew(false); setSelectedCampaign(null); loadData() }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
