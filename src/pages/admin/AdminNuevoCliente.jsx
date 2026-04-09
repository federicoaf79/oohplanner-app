import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check, UserPlus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
}

export default function AdminNuevoCliente() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    orgName:    '',
    slug:       '',
    planSlug:   'starter',
    trialDays:  7,
    ownerName:  '',
    ownerEmail: '',
  })
  const [result, setResult]     = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState('')
  const [copied, setCopied]     = useState(null)

  const { data: plans = [] } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const { data } = await supabase
        .from('plans')
        .select('id, name, slug, price_usd')
        .eq('is_active', true)
        .order('sort_order')
      return data ?? []
    },
  })

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'orgName') next.slug = slugify(value)
      return next
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setCreating(true)

    try {
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + Number(form.trialDays))

      const selectedPlan = plans.find(p => p.slug === form.planSlug)

      const { data: org, error: orgErr } = await supabase
        .from('organisations')
        .insert({
          name: form.orgName,
          slug: form.slug,
          plan: form.planSlug,
          plan_price_usd: selectedPlan?.price_usd ?? 0,
          trial_ends_at: trialEndsAt.toISOString(),
          subscription_status: 'trial',
        })
        .select()
        .single()

      if (orgErr) throw new Error(orgErr.message)

      const mailTemplate =
        `Hola ${form.ownerName},\n\n` +
        `Tu acceso a OOH Planner está listo.\n` +
        `Plan: ${selectedPlan?.name ?? form.planSlug} — Trial: ${form.trialDays} días gratis.\n\n` +
        `Ingresá con este link: [LINK DE INVITACIÓN]\n\n` +
        `¡Bienvenido/a a OOH Planner!`

      setResult({
        orgId:       org.id,
        orgName:     org.name,
        ownerEmail:  form.ownerEmail,
        ownerName:   form.ownerName,
        planName:    selectedPlan?.name ?? form.planSlug,
        trialDays:   form.trialDays,
        mailTemplate,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2500)
  }

  function resetForm() {
    setResult(null)
    setForm({ orgName: '', slug: '', planSlug: 'starter', trialDays: 7, ownerName: '', ownerEmail: '' })
    setError('')
  }

  if (result) {
    return (
      <div className="max-w-lg space-y-4 animate-fade-in">
        <button
          onClick={() => navigate('/admin/empresas')}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a empresas
        </button>

        <Card>
          <CardHeader title="¡Empresa creada exitosamente!" />
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-400">
              Organización <strong>{result.orgName}</strong> creada. Plan: {result.planName} — Trial: {result.trialDays} días.
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-2">
                Para invitar al owner, usá <strong>Supabase Dashboard → Authentication → Users → Invite user</strong> con este email:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 rounded-lg bg-surface-700 px-3 py-2 text-xs text-slate-300 font-mono truncate">
                  {result.ownerEmail}
                </code>
                <button
                  onClick={() => copy(result.ownerEmail, 'email')}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors text-xs"
                >
                  {copied === 'email'
                    ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                    : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Después de que el usuario acepte la invitación, actualizá manualmente su <code className="text-slate-500">org_id</code> al ID de esta organización.
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-2">Template de mail de bienvenida:</p>
              <div className="rounded-lg border border-slate-700 p-3">
                <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">
                  {result.mailTemplate}
                </pre>
              </div>
              <button
                onClick={() => copy(result.mailTemplate, 'mail')}
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
              >
                {copied === 'mail'
                  ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copiado</>
                  : <><Copy className="h-3.5 w-3.5" /> Copiar template</>}
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={() => navigate(`/admin/empresas/${result.orgId}`)} className="flex-1">
                Ver detalle
              </Button>
              <Button variant="secondary" onClick={resetForm} className="flex-1">
                Crear otra
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-4 animate-fade-in">
      <button
        onClick={() => navigate('/admin/empresas')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a empresas
      </button>

      <div>
        <h1 className="text-xl font-bold text-white">Alta de cliente</h1>
        <p className="text-sm text-slate-500">Crear nueva organización en la plataforma</p>
      </div>

      <Card>
        <form onSubmit={handleCreate} className="space-y-4">
          <CardHeader title="Datos de la empresa" />

          <Input
            label="Nombre de empresa"
            required
            value={form.orgName}
            onChange={e => set('orgName', e.target.value)}
            placeholder="Acme Publicidad"
          />

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Slug</label>
            <input
              className="input-field w-full font-mono text-sm"
              value={form.slug}
              onChange={e => set('slug', e.target.value)}
              required
              placeholder="acme-publicidad"
            />
            <p className="mt-1 text-xs text-slate-600">
              Identificador único, URL-friendly (se genera automáticamente desde el nombre)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Plan</label>
            <select
              className="input-field w-full"
              value={form.planSlug}
              onChange={e => set('planSlug', e.target.value)}
            >
              {plans.map(p => (
                <option key={p.id} value={p.slug}>
                  {p.name}{p.price_usd > 0 ? ` — USD ${p.price_usd}/mes` : ' — Custom'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Días de trial</label>
            <input
              type="number"
              min="1"
              max="365"
              className="input-field w-full"
              value={form.trialDays}
              onChange={e => set('trialDays', Number(e.target.value))}
            />
          </div>

          <div className="pt-2 border-t border-slate-800">
            <CardHeader title="Datos del owner" />
          </div>

          <Input
            label="Nombre completo"
            required
            value={form.ownerName}
            onChange={e => set('ownerName', e.target.value)}
            placeholder="María García"
          />

          <Input
            label="Email"
            type="email"
            required
            value={form.ownerEmail}
            onChange={e => set('ownerEmail', e.target.value)}
            placeholder="maria@empresa.com"
          />

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}

          <Button type="submit" loading={creating} className="w-full">
            <UserPlus className="h-4 w-4 mr-1.5" />
            Crear empresa
          </Button>
        </form>
      </Card>
    </div>
  )
}
