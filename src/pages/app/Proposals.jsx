import { useState, useEffect } from 'react'
import { Plus, Search, FileText, Pencil, Download, MessageCircle, Zap } from 'lucide-react'
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
  const [activating, setActivating]   = useState(null) // proposal id being activated

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
      // Buscar los carteles guardados en proposal_items + inventory
      const { data: items } = await supabase
        .from('proposal_items')
        .select(`
          rate,
          notes,
          site:inventory(
            id, name, address, city, format,
            latitude, longitude, daily_traffic,
            base_rate, photo_url
          )
        `)
        .eq('proposal_id', p.id)

      const sites = (items ?? [])
        .filter(i => i.site)
        .map(i => ({
          id:              i.site.id,
          name:            i.site.name,
          address:         i.site.address,
          city:            i.site.city,
          format:          i.site.format,
          latitude:        i.site.latitude,
          longitude:       i.site.longitude,
          monthly_impacts: i.site.daily_traffic ? i.site.daily_traffic * 30 : 0,
          list_price:      i.rate ?? i.site.base_rate ?? 0,
          client_price:    i.rate
            ? Math.round(i.rate * (1 - (p.discount_pct ?? 0) / 100))
            : 0,
          justification:   i.notes ?? null,
          photo_url:       i.site.photo_url ?? null,
        }))

      const brief = p.brief_data ?? {}

      // Reconstruir formData desde brief_data
      const formData = {
        clientName:   p.client_name ?? '',
        clientEmail:  p.client_email ?? '',
        objective:    brief.objective ?? '',
        formats:      brief.formats ?? [],
        provinces:    brief.provinces ?? [],
        cities:       brief.cities ?? [brief.city ?? ''],
        budget:       brief.budget ?? '0',
        discountPct:  p.discount_pct ?? 0,
        startDate:    brief.startDate ?? '',
        endDate:      brief.endDate ?? p.valid_until ?? '',
        audience:     brief.audience ?? {},
      }

      // Calcular totales
      const discount    = p.discount_pct ?? 0
      const listTotal   = sites.reduce((s, x) => s + (x.list_price ?? 0), 0)
      const clientTotal = p.total_value ?? Math.round(listTotal * (1 - discount / 100))
      const totalImpacts = sites.reduce((s, x) => s + (x.monthly_impacts ?? 0), 0)

      // Armar results con una sola opción (la guardada)
      const optionLabel = brief.selectedOption === 'B' ? 'Máximo Impacto' : 'Máximo Alcance'
      const singleOption = {
        title:             optionLabel,
        rationale:         null,
        sites,
        total_list_price:  listTotal,
        total_client_price: clientTotal,
        discount_amount:   listTotal - clientTotal,
        budget_remaining:  Math.max(0, Number(brief.budget ?? 0) - clientTotal),
        next_billboard_gap: 0,
        total_impacts:     totalImpacts,
        estimated_reach:   Math.round(totalImpacts * 0.19),
        cpm:               totalImpacts > 0 ? Math.round((clientTotal / totalImpacts) * 1000) : 0,
        format_mix:        {},
      }

      const results = {
        optionA: singleOption,
        optionB: null,
        audience_mode: 'full',
        audience_note: null,
      }

      await generateProposalPDF({ results, formData, profile: { ...profile, email: user?.email }, org })

    } catch (err) {
      console.error('PDF error:', err)
      alert('Error al generar el PDF: ' + err.message)
    } finally {
      setGeneratingPDF(null)
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
    <div className="space-y-5 animate-fade-in">
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
          {filtered.map(p => (
            <div key={p.id} className="card p-4 hover:border-brand/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white truncate">{p.title}</p>
                    <StatusBadge status={p.status} type="proposal" />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{p.client_name}</p>
                  {p.creator?.full_name && (
                    <p className="text-xs text-slate-600">Creado por: {p.creator.full_name}</p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                    <span>{formatDate(p.created_at)}</span>
                    {p.total_value && (
                      <span className="font-medium text-slate-400">{formatCurrency(p.total_value)}</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {/* PDF */}
                  <button
                    type="button"
                    onClick={() => handlePDF(p)}
                    disabled={generatingPDF === p.id}
                    className="flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-800 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-brand/40 hover:text-brand transition-colors disabled:opacity-50"
                    title="Descargar PDF"
                  >
                    {generatingPDF === p.id
                      ? <span className="h-3 w-3 animate-spin rounded-full border border-slate-600 border-t-brand" />
                      : <Download className="h-3 w-3" />
                    }
                    PDF
                  </button>

                  {/* WhatsApp */}
                  <button
                    type="button"
                    onClick={() => handleWhatsApp(p)}
                    className="flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-800 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-green-500/40 hover:text-green-400 transition-colors"
                    title="Compartir por WhatsApp"
                  >
                    <MessageCircle className="h-3 w-3" />
                    WA
                  </button>

                  {/* Activar campaña */}
                  {p.status === 'accepted' && (!p.workflow_status || p.workflow_status === 'pending') && (
                    <button
                      type="button"
                      onClick={() => handleActivate(p)}
                      disabled={activating === p.id}
                      className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                      title="Activar como campaña"
                    >
                      {activating === p.id
                        ? <span className="h-3 w-3 animate-spin rounded-full border border-amber-500/50 border-t-amber-400" />
                        : <Zap className="h-3 w-3" />}
                      Activar
                    </button>
                  )}

                  {/* Editar */}
                  {canEdit(p) && (
                    <button
                      type="button"
                      onClick={() => navigate(`/app/proposals/${p.id}/edit`)}
                      className="flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-800 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-brand/40 hover:text-brand transition-colors"
                      title="Editar propuesta"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
