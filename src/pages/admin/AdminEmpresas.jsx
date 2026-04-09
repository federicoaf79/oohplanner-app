import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, RefreshCw, Mail, PlusCircle, ArrowUpDown, Copy, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import { cn } from '../../lib/utils'

export function StatusBadge({ status, trialEndsAt }) {
  const now = new Date()
  const isExpiredTrial = status === 'trial' && trialEndsAt && new Date(trialEndsAt) < now
  const daysLeft = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt) - now) / (1000 * 60 * 60 * 24))
    : 0

  if (isExpiredTrial) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
        Vencida
      </span>
    )
  }

  const configs = {
    trial: {
      cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      label: `Trial (${daysLeft}d)`,
    },
    active: {
      cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      label: 'Activa',
    },
    expired: {
      cls: 'bg-red-500/20 text-red-400 border-red-500/30',
      label: 'Vencida',
    },
    suspended: {
      cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      label: 'Suspendida',
    },
  }

  const cfg = configs[status] ?? configs.trial
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

const STATUS_OPTIONS = [
  { value: 'trial',     label: 'Trial' },
  { value: 'active',    label: 'Activa' },
  { value: 'expired',   label: 'Vencida' },
  { value: 'suspended', label: 'Suspendida' },
]

function mailTemplate(type, org) {
  if (type === 'bienvenida') {
    return `Hola ${org.name},\n\nBienvenidos a OOH Planner. Tu acceso está listo.\nPlan: ${org.plan ?? 'Starter'} — Trial: 7 días gratis.\n\nCualquier consulta escribinos a hola@oohplanner.net\n\n¡Bienvenidos!`
  }
  return `Hola ${org.name},\n\nTu período de prueba gratuito en OOH Planner ha vencido.\n\nPara continuar usando la plataforma contactá a nuestro equipo:\nhola@oohplanner.net\n\n¡Esperamos seguir trabajando juntos!`
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-surface-800 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="font-semibold text-white text-sm">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export default function AdminEmpresas() {
  const navigate = useNavigate()
  const [orgs, setOrgs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [plans, setPlans]       = useState([])
  const [search, setSearch]     = useState('')
  const [planModal, setPlanModal]     = useState(null)
  const [statusModal, setStatusModal] = useState(null)
  const [mailModal, setMailModal]     = useState(null)
  const [saving, setSaving]     = useState(false)
  const [copied, setCopied]     = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: orgsData }, { data: plansData }] = await Promise.all([
      supabase
        .from('organisations')
        .select('id, name, slug, plan, subscription_status, trial_ends_at, plan_price_usd, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('plans')
        .select('id, name, slug, price_usd')
        .eq('is_active', true)
        .order('sort_order'),
    ])
    setOrgs(orgsData ?? [])
    setPlans(plansData ?? [])
    setLoading(false)
  }

  async function handleChangePlan(org, planSlug, priceUsd) {
    setSaving(true)
    await supabase
      .from('organisations')
      .update({ plan: planSlug, plan_price_usd: priceUsd })
      .eq('id', org.id)
    setSaving(false)
    setPlanModal(null)
    loadData()
  }

  async function handleChangeStatus(org, newStatus) {
    setSaving(true)
    await supabase
      .from('organisations')
      .update({ subscription_status: newStatus })
      .eq('id', org.id)
    setSaving(false)
    setStatusModal(null)
    loadData()
  }

  function copyMail(type) {
    navigator.clipboard.writeText(mailTemplate(type, mailModal.org))
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const filtered = orgs.filter(o =>
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.slug?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Empresas</h1>
          <p className="text-sm text-slate-500">{orgs.length} organizaciones registradas</p>
        </div>
        <Button onClick={() => navigate('/admin/empresas/nueva')} size="sm">
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Nueva empresa
        </Button>
      </div>

      <input
        type="text"
        placeholder="Buscar por nombre o slug…"
        className="input-field w-full max-w-sm"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-surface-800 text-slate-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Empresa</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Registro</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map(org => (
              <tr key={org.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{org.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{org.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="capitalize text-slate-300">{org.plan ?? '—'}</span>
                  {org.plan_price_usd > 0 && (
                    <span className="ml-2 text-xs text-slate-500">USD {org.plan_price_usd}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={org.subscription_status} trialEndsAt={org.trial_ends_at} />
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(org.created_at).toLocaleDateString('es-AR')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <ActionBtn
                      title="Ver detalle"
                      onClick={() => navigate(`/admin/empresas/${org.id}`)}
                      icon={<Eye className="h-4 w-4" />}
                    />
                    <ActionBtn
                      title="Cambiar plan"
                      onClick={() => setPlanModal({ org })}
                      icon={<ArrowUpDown className="h-4 w-4" />}
                    />
                    <ActionBtn
                      title="Cambiar estado"
                      onClick={() => setStatusModal({ org })}
                      icon={<RefreshCw className="h-4 w-4" />}
                    />
                    <ActionBtn
                      title="Enviar mail"
                      onClick={() => { setCopied(null); setMailModal({ org }) }}
                      icon={<Mail className="h-4 w-4" />}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No se encontraron empresas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal — cambiar plan */}
      {planModal && (
        <Modal title={`Cambiar plan — ${planModal.org.name}`} onClose={() => setPlanModal(null)}>
          <div className="space-y-2">
            {plans.map(p => (
              <button
                key={p.id}
                disabled={saving}
                onClick={() => handleChangePlan(planModal.org, p.slug, p.price_usd)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors',
                  planModal.org.plan === p.slug
                    ? 'border-brand bg-brand/10 text-white'
                    : 'border-slate-700 hover:border-brand/50 hover:bg-brand/5 text-slate-300'
                )}
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-sm text-slate-400">
                  {p.price_usd > 0 ? `USD ${p.price_usd}/mes` : 'Custom'}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Modal — cambiar estado */}
      {statusModal && (
        <Modal title={`Cambiar estado — ${statusModal.org.name}`} onClose={() => setStatusModal(null)}>
          <div className="space-y-2">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.value}
                disabled={saving}
                onClick={() => handleChangeStatus(statusModal.org, s.value)}
                className={cn(
                  'w-full px-4 py-3 rounded-lg border text-left font-medium transition-colors',
                  statusModal.org.subscription_status === s.value
                    ? 'border-brand bg-brand/10 text-white'
                    : 'border-slate-700 hover:border-brand/50 hover:bg-brand/5 text-slate-300'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Modal — mail */}
      {mailModal && (
        <Modal title={`Templates de mail — ${mailModal.org.name}`} onClose={() => setMailModal(null)}>
          <p className="text-xs text-slate-500 mb-4">
            Copiá el template y envialo desde tu cliente de correo. El envío automático se configura con Resend.
          </p>
          <div className="space-y-3">
            {['bienvenida', 'vencimiento'].map(type => (
              <div key={type} className="rounded-lg border border-slate-700 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-300 capitalize">{type}</span>
                  <button
                    onClick={() => copyMail(type)}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-brand/20 text-brand hover:bg-brand/30 transition-colors"
                  >
                    {copied === type ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
                  </button>
                </div>
                <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono leading-relaxed">
                  {mailTemplate(type, mailModal.org)}
                </pre>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

function ActionBtn({ title, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded-lg p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
    >
      {icon}
    </button>
  )
}
