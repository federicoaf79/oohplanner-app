import { useState, useEffect } from 'react'
import { Plus, Search, FileText, Pencil, Download, MessageCircle, Zap, ChevronDown } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { formatDate, formatCurrency } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'
import { generateProposalPDF } from '../../features/proposals/generateProposalPDF'

export default function Proposals() {
  const { profile, isOwner, isManager, isSalesperson, org, user } = useAuth()
  const navigate = useNavigate()

  const [proposals, setProposals]     = useState([])
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')
  const [generatingPDF, setGeneratingPDF] = useState(null)
  const [activating, setActivating]   = useState(null)
  const [deleting, setDeleting]        = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [statusChanging, setStatusChanging] = useState(null)
  const [statusMenuOpen, setStatusMenuOpen] = useState(null) // proposal id
  const [confirmActivate, setConfirmActivate] = useState(null)

  useEffect(() => {
    if (!profile?.org_id) return
    supabase
      .from('proposals')
      .select('*, creator:profiles!created_by(full_name)')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('proposals fetch error:', error.message)
        setProposals(data ?? [])
        setLoading(false)
      })
  }, [profile?.org_id])

  const filtered = proposals.filter(p =>
    (p.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.client_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function canEdit(p) {
    const ws = p.workflow_status ?? 'pending'
    if (isOwner) return true
    if (isManager) return ['pending', 'approved'].includes(ws)
    if (isSalesperson) return p.created_by === profile?.id && ws === 'pending'
    return false
  }

  async function handlePDF(p) {
    setGeneratingPDF(p.id)
    try {
      const brief = p.brief_data ?? {}

      // ── 1. Cargar proposal_items con datos completos ──────────────────────
      const { data: items } = await supabase
        .from('proposal_items')
        .select(`
          site_id, rate, duration, discount_pct, notes, start_date, end_date,
          site:inventory(
            id, name, address, city, format,
            latitude, longitude, daily_traffic,
            base_rate, photo_url
          )
        `)
        .eq('proposal_id', p.id)

      // Construir sites con precios correctos
      // rate = precio lista mensual por cartel (guardado al momento del wizard)
      // discount_pct por ítem (si existe) tiene prioridad sobre p.discount_pct
      const sites = (items ?? [])
        .filter(i => i.site)
        .map(i => {
          const listPx   = i.rate ?? i.site.base_rate ?? 0
          const discount = (i.discount_pct > 0) ? i.discount_pct : (p.discount_pct ?? 0)
          const clientPx = Math.round(listPx * (1 - discount / 100))
          const impacts  = i.site.daily_traffic ? i.site.daily_traffic * 30 : 0

          return {
            id:              i.site.id,
            name:            i.site.name,
            address:         i.site.address,
            city:            i.site.city,
            format:          i.site.format,
            latitude:        i.site.latitude,
            longitude:       i.site.longitude,
            monthly_impacts: impacts,
            list_price:      listPx,
            client_price:    clientPx,
            justification:   i.notes ?? null,
            photo_url:       i.site.photo_url ?? null,
          }
        })

      // ── 2. Reconstruir formData desde brief_data + columnas de proposals ──
      const formData = {
        clientName:  p.client_name  ?? '',
        clientEmail: p.client_email ?? '',
        objective:   brief.objective  ?? '',
        formats:     brief.formats    ?? [],
        provinces:   brief.provinces  ?? [],
        cities:      brief.cities     ?? (brief.city ? [brief.city] : []),
        budget:      brief.budget     ?? p.total_value ?? 0,
        discountPct: p.discount_pct   ?? 0,
        startDate:   brief.startDate  ?? p.start_date ?? '',
        endDate:     brief.endDate    ?? p.end_date   ?? p.valid_until ?? '',
        audience:    brief.audience   ?? {},
      }

      // ── 3. Calcular totales desde sites reales ────────────────────────────
      const listTotal    = sites.reduce((s, x) => s + (x.list_price  ?? 0), 0)
      const clientTotal  = sites.reduce((s, x) => s + (x.client_price ?? 0), 0)
      const totalImpacts = sites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0)
      const discountAmt  = listTotal - clientTotal

      const optionLabel = brief.selectedOption === 'B' ? 'Máximo Impacto' : 'Máximo Alcance'
      const singleOption = {
        title:              optionLabel,
        rationale:          brief.rationale ?? null,
        sites,
        total_list_price:   listTotal,
        total_client_price: clientTotal,
        discount_amount:    discountAmt,
        budget_remaining:   Math.max(0, Number(formData.budget) - clientTotal),        next_billboard_gap: 0,
        total_impacts:      totalImpacts,
        cpm:                totalImpacts > 0
          ? Math.round(clientTotal / (totalImpacts / 1000)) : 0,
        format_mix: {},
      }

      const results = {
        ...singleOption,        // spread plano: sites, total_list_price, total_client_price, etc.
        optionA:       singleOption,
        optionB:       null,
        audience_mode: 'full',
        audience_note: null,
      }

      // ── 4. Enriquecer con caras, dims e iluminación desde inventory ───────
      const siteIds = sites.map(s => s.id).filter(Boolean)
      let siteCarasMap = {}

      if (siteIds.length > 0) {
        const { data: invData } = await supabase
          .from('inventory')
          .select('id, caras, photo_url, image_url, illuminated, width_ft, height_ft, latitude, longitude')
          .in('id', siteIds)

        for (const inv of invData ?? []) {
          const caras = Array.isArray(inv.caras) ? inv.caras : []
          const cara  = caras[0] ?? null
          siteCarasMap[inv.id] = {
            photoUrl:   cara?.photo_url ?? inv.photo_url ?? inv.image_url ?? null,
            zone:       cara?.billboard_zone ?? null,
            illuminated: inv.illuminated ?? false,
            width:       inv.width_ft   ?? null,
            height:      inv.height_ft  ?? null,
            latitude:    inv.latitude   ?? null,
            longitude:   inv.longitude  ?? null,
          }
          // Enriquecer coords en site si faltan
          const site = sites.find(s => s.id === inv.id)
          if (site) {
            if (!site.latitude  && inv.latitude)  site.latitude  = inv.latitude
            if (!site.longitude && inv.longitude) site.longitude = inv.longitude
          }
        }
      }

      // ── 5. Generar mockups (arte de empresa como fallback) ────────────────
      const FORMAT_TO_ART = {
        billboard: 'h', digital: 'h', ambient: 'v',
        urban_furniture: 'v', urban_furniture_digital: 'v',
        poster: 'v', mobile_screen: 'sq',
      }
      const artworkMap = {
        h:  org?.artwork_h_url  ?? null,
        v:  org?.artwork_v_url  ?? null,
        sq: org?.artwork_sq_url ?? null,
      }

      const { generateMockup } = await import('../../lib/generateMockup')
      const mockupMap = {}
      const mockupTasks = []

      for (const site of sites) {
        const siteData = siteCarasMap[site.id]
        if (!siteData?.zone || !siteData?.photoUrl) continue
        const artSlot = FORMAT_TO_ART[site.format] ?? 'h'
        const artUrl  = artworkMap[artSlot]
        if (!artUrl) continue
        mockupTasks.push(
          generateMockup(siteData.photoUrl, siteData.zone, artUrl, { maxWidth: 800, quality: 0.82 })
            .then(dataUrl => { mockupMap[site.id] = dataUrl })
            .catch(() => {})
        )
      }
      for (let i = 0; i < mockupTasks.length; i += 5) {
        await Promise.all(mockupTasks.slice(i, i + 5))
      }

      // ── 6. Ocupados (excluir la propuesta actual) ─────────────────────────
      let occupiedSiteIds = new Set()
      if (siteIds.length > 0 && formData.startDate && formData.endDate) {
        const { data: conflicts } = await supabase
          .from('proposal_items')
          .select('site_id, start_date, end_date, proposal:proposals!proposal_id(id, status)')
          .in('site_id', siteIds)
          .neq('proposal_id', p.id)

        for (const item of conflicts ?? []) {
          if (item.proposal?.status !== 'accepted') continue
          if (!item.start_date || !item.end_date) continue
          const overlaps =
            new Date(item.start_date) <= new Date(formData.endDate) &&
            new Date(item.end_date)   >= new Date(formData.startDate)
          if (overlaps) occupiedSiteIds.add(item.site_id)
        }
      }

      // ── 7. Generar PDF ────────────────────────────────────────────────────
      await generateProposalPDF({
        results,
        formData,
        profile:        { ...profile, email: user?.email },
        org,
        activeOption:   'A',
        occupiedSiteIds,
        artworkMap,
        mockupMap,
        siteCarasMap,
      })

    } catch (err) {
      console.error('PDF error:', err)
      alert('Error al generar el PDF: ' + err.message)
    } finally {
      setGeneratingPDF(null)
    }
  }

  async function handleDelete(p) {
    setDeleting(p.id)
    setConfirmDelete(null)
    try {
      // Eliminar proposal_items primero (FK constraint)
      await supabase.from('proposal_items').delete().eq('proposal_id', p.id)
      const { error } = await supabase.from('proposals').delete().eq('id', p.id)
      if (error) throw error
      setProposals(prev => prev.filter(x => x.id !== p.id))
    } catch (err) {
      console.error('delete error:', err.message)
      alert('Error al eliminar: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  async function handleActivate(p) {
    setActivating(p.id)
    // Try with closed_at; fall back without it if column doesn't exist yet
    let { error } = await supabase
      .from('proposals')
      .update({ workflow_status: 'approved', closed_at: new Date().toISOString() })
      .eq('id', p.id)

    if (error?.message?.includes('closed_at') || error?.message?.includes('column')) {
      ;({ error } = await supabase
        .from('proposals')
        .update({ workflow_status: 'approved' })
        .eq('id', p.id))
    }

    if (!error) {
      setProposals(prev => prev.map(x =>
        x.id === p.id ? { ...x, workflow_status: 'approved' } : x
      ))
    } else {
      console.error('activate error:', error.message)
    }
    setActivating(null)
  }

  async function handleStatusChange(p, newStatus) {
    setStatusChanging(p.id + newStatus)
    const patch = { status: newStatus }
    if (newStatus === 'accepted') patch.accepted_at = new Date().toISOString()
    const { error } = await supabase.from('proposals').update(patch).eq('id', p.id)
    if (!error) {
      setProposals(prev => prev.map(x => x.id === p.id ? { ...x, status: newStatus } : x))
      if (newStatus === 'accepted') {
        await supabase.from('proposals').update({ workflow_status: 'approved' }).eq('id', p.id)
        setProposals(prev => prev.map(x => x.id === p.id ? { ...x, workflow_status: 'approved' } : x))
        // Fire and forget — no bloquea UI
        autoCreateCommissionsOnAccept(p)
      }
    }
    setStatusChanging(null)
  }

  async function autoCreateCommissionsOnAccept(proposal) {
    const sellerId = proposal.created_by
    if (!sellerId) {
      console.warn('Proposal sin created_by, no se crean comisiones:', proposal.id)
      return
    }

    const { data: seller, error: sellerErr } = await supabase
      .from('profiles')
      .select(`
        id, org_id, commission_pct, supervisor_id,
        supervisor:profiles!profiles_supervisor_id_fkey(
          id, is_supervisor, supervisor_commission_pct
        )
      `)
      .eq('id', sellerId)
      .single()

    if (sellerErr || !seller) {
      console.error('Error cargando seller profile:', sellerErr)
      return
    }

    const commissionsToInsert = []

    // internal_seller — solo si pct > 0
    const sellerPct = parseFloat(seller.commission_pct ?? 0)
    if (sellerPct > 0) {
      const { data: existing } = await supabase
        .from('campaign_commissions')
        .select('id')
        .eq('proposal_id', proposal.id)
        .eq('commission_type', 'internal_seller')
        .maybeSingle()
      if (!existing) {
        commissionsToInsert.push({
          org_id:                 seller.org_id,
          proposal_id:            proposal.id,
          commission_type:        'internal_seller',
          beneficiary_profile_id: sellerId,
          beneficiary_contact_id: null,
          commission_pct:         sellerPct,
          amount_fixed:           null,
          notes:                  'Auto-creada al aceptar. % snapshot del vendedor al momento de la aceptación.',
          created_by:             profile.id,
        })
      }
    }

    // supervisor_override — solo si supervisor existe, is_supervisor=true y pct > 0
    const sup = seller.supervisor
    if (sup && sup.is_supervisor && parseFloat(sup.supervisor_commission_pct ?? 0) > 0) {
      const { data: existing } = await supabase
        .from('campaign_commissions')
        .select('id')
        .eq('proposal_id', proposal.id)
        .eq('commission_type', 'supervisor_override')
        .maybeSingle()
      if (!existing) {
        commissionsToInsert.push({
          org_id:                 seller.org_id,
          proposal_id:            proposal.id,
          commission_type:        'supervisor_override',
          beneficiary_profile_id: sup.id,
          beneficiary_contact_id: null,
          commission_pct:         parseFloat(sup.supervisor_commission_pct),
          amount_fixed:           null,
          notes:                  'Override auto-creado al aceptar. % snapshot del supervisor del vendedor.',
          created_by:             profile.id,
        })
      }
    }

    if (commissionsToInsert.length === 0) {
      console.log('No hay comisiones para auto-crear (pct=0 en todos los niveles)')
      return
    }

    const { error: insErr } = await supabase
      .from('campaign_commissions')
      .insert(commissionsToInsert)

    if (insErr) {
      console.error('Error insertando comisiones auto:', insErr)
    } else {
      console.log(`Auto-creadas ${commissionsToInsert.length} comisión(es) para propuesta ${proposal.id}`)
    }
  }

  function handleWhatsApp(p) {
    const monto = p.total_value ? formatCurrency(p.total_value) : 'a consultar'
    const fecha = formatDate(p.created_at)
    const msg = [
      `Hola! Te comparto la propuesta de pauta OOH para ${p.client_name ?? 'tu empresa'}:`,
      `📋 ${p.title}`,
      `💰 Inversión: ${monto}`,
      `📅 Generada: ${fecha}`,
      ``,
      `Para ver el detalle completo, solicitá acceso a la plataforma OOH Planner.`,
    ].join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="space-y-5 animate-fade-in" onClick={() => statusMenuOpen && setStatusMenuOpen(null)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Propuestas</h2>
          <p className="text-sm text-slate-500">{proposals.length} propuestas</p>
        </div>
        <Link to="/app/proposals/new" className="btn-primary text-xs px-3 py-1.5 gap-1.5">
          <Plus className="h-4 w-4" />
          Nueva propuesta
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input className="input-field pl-9" placeholder="Buscar por título o cliente..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-700 py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-slate-600" />
          <p className="font-medium text-slate-400">{search ? 'Sin resultados' : 'Sin propuestas aún'}</p>
          <p className="mt-1 text-sm text-slate-600">Crea tu primera propuesta comercial</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const STATUS_OPTIONS = [
              { id: 'draft', label: 'Borrador' },
              { id: 'sent', label: 'Enviada' },
              { id: 'accepted', label: 'Aceptada' },
            ]
            const isActivated = p.workflow_status && p.workflow_status !== 'pending'
            const canChangeStatus = isOwner || isManager || (isSalesperson && p.created_by === profile?.id)

            const isOpen = statusMenuOpen === p.id

            return (
            <div key={p.id} className="card p-4 hover:border-brand/30 transition-colors">
              {/* Fila 1: info */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white truncate">{p.title}</p>
                    <StatusBadge status={p.status} type="proposal" />
                    {isActivated && <span className="text-xs text-brand">· Activa en Campañas</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{p.client_name}</p>
                  {p.creator?.full_name && (
                    <p className="text-xs text-slate-600">Creado por: {p.creator.full_name}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {p.total_value > 0 && (
                    <p className="font-semibold text-slate-300 text-sm">{formatCurrency(p.total_value)}</p>
                  )}
                  <p className="text-xs text-slate-600 mt-0.5">{formatDate(p.created_at)}</p>
                </div>
              </div>

              {/* Fila 2: acciones */}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-surface-700/50 pt-3">
                {/* Izquierda: PDF + WA */}
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => handlePDF(p)} disabled={generatingPDF === p.id}
                    className="flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-800 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-brand/40 hover:text-brand transition-colors disabled:opacity-50">
                    {generatingPDF === p.id
                      ? <span className="h-3 w-3 animate-spin rounded-full border border-slate-600 border-t-brand" />
                      : <Download className="h-3 w-3" />}
                    PDF
                  </button>
                  <button type="button" onClick={() => handleWhatsApp(p)}
                    className="flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-800 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors">
                    <MessageCircle className="h-3 w-3" />
                    WA
                  </button>
                </div>

                {/* Derecha: Estado + Activar + Editar + Eliminar */}
                <div className="flex items-center gap-1.5">
                  {/* Dropdown estado */}
                  {canChangeStatus && !isActivated && (
                    <div className="relative">
                      <button type="button"
                        onClick={e => { e.stopPropagation(); setStatusMenuOpen(isOpen ? null : p.id) }}
                        className="flex items-center gap-1.5 rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-brand/40 hover:text-brand transition-colors">
                        {statusChanging?.startsWith(p.id)
                          ? <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                          : null}
                        Estado
                        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-surface-600 bg-surface-800 shadow-xl py-1"
                          onClick={e => e.stopPropagation()}>
                          {STATUS_OPTIONS.map(opt => {
                            const isCurrent = p.status === opt.id
                            return (
                              <button key={opt.id} type="button" disabled={!!statusChanging || isCurrent}
                                onClick={() => { setStatusMenuOpen(null); if (opt.id === 'accepted') { setConfirmActivate(p) } else { handleStatusChange(p, opt.id) } }}
                                className="w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-surface-700 transition-colors text-slate-300 disabled:opacity-50 flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${isCurrent ? 'bg-brand' : 'bg-slate-600'}`} />
                                {opt.label}
                                {isCurrent && <span className="ml-auto text-[10px] text-brand">actual</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Editar */}
                  {canEdit(p) && (
                    <button type="button" onClick={() => navigate(`/app/proposals/${p.id}/edit`)}
                      className="flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-800 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-brand/40 hover:text-brand transition-colors">
                      <Pencil className="h-3 w-3" />
                      Editar
                    </button>
                  )}

                  {/* Eliminar */}
                  {(isOwner || isManager) && (
                    <button type="button" onClick={() => setConfirmDelete(p)} disabled={deleting === p.id}
                      className="rounded-lg border border-surface-600 bg-surface-800 px-2 py-1.5 text-xs text-slate-500 hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50">
                      {deleting === p.id
                        ? <span className="h-3 w-3 animate-spin rounded-full border border-slate-600 border-t-red-400" />
                        : '✕'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* Modal confirmación activar campaña */}
      {confirmActivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="card w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-white">¿Activar como campaña?</h3>
            <p className="text-sm text-slate-400">
              La propuesta <span className="font-semibold text-white">"{confirmActivate.client_name}"</span> pasará a <span className="font-semibold text-brand">Campaña Activa</span>. Quedará visible aquí como Aceptada.
            </p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmActivate(null)} className="flex-1 rounded-lg border border-surface-600 px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
              <button onClick={async () => { const p = confirmActivate; setConfirmActivate(null); await handleStatusChange(p, 'accepted'); navigate('/app/campaigns') }} className="flex-1 rounded-lg bg-brand/20 border border-brand/40 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/30 transition-colors">Sí, activar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="card w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-white">¿Eliminar propuesta?</h3>
            <p className="text-sm text-slate-400">
              Vas a eliminar <span className="font-semibold text-white">"{confirmDelete.title}"</span> de <span className="font-semibold text-white">{confirmDelete.client_name}</span>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-lg border border-surface-600 px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 rounded-lg bg-red-500/20 border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}