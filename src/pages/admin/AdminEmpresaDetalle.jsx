import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Users, Package, FileText,
  Save, ExternalLink, TicketCheck,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import { StatusBadge } from './AdminEmpresas'
import { RoleBadge } from '../../components/ui/Badge'

export default function AdminEmpresaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [org, setOrg]             = useState(null)
  const [users, setUsers]         = useState([])
  const [invCount, setInvCount]   = useState(0)
  const [propCount, setPropCount] = useState(0)
  const [tickets, setTickets]     = useState([])
  const [notes, setNotes]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [savingNotes, setSavingNotes] = useState(false)
  const [savedNotes, setSavedNotes]   = useState(false)

  useEffect(() => {
    async function load() {
      const [
        { data: orgData },
        { data: usersData },
        { count: invTotal },
        { count: propTotal },
        { data: ticketsData },
      ] = await Promise.all([
        supabase
          .from('organisations')
          .select('*')
          .eq('id', id)
          .single(),
        supabase
          .from('profiles')
          .select('id, full_name, role, is_active, created_at')
          .eq('org_id', id)
          .order('created_at'),
        supabase
          .from('inventory')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', id),
        supabase
          .from('proposals')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', id),
        supabase
          .from('support_tickets')
          .select('id, subject, status, priority, created_at')
          .eq('org_id', id)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      setOrg(orgData)
      setNotes(orgData?.notes ?? '')
      setUsers(usersData ?? [])
      setInvCount(invTotal ?? 0)
      setPropCount(propTotal ?? 0)
      setTickets(ticketsData ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSaveNotes() {
    setSavingNotes(true)
    await supabase
      .from('organisations')
      .update({ notes })
      .eq('id', id)
    setSavingNotes(false)
    setSavedNotes(true)
    setTimeout(() => setSavedNotes(false), 3000)
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!org) return <div className="py-20 text-center text-slate-500">Empresa no encontrada.</div>

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <button
        onClick={() => navigate('/admin/empresas')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a empresas
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">{org.name}</h1>
          <p className="text-sm text-slate-500 font-mono">{org.slug}</p>
        </div>
        <StatusBadge status={org.subscription_status} trialEndsAt={org.trial_ends_at} />
      </div>

      {/* Datos generales */}
      <Card>
        <CardHeader title="Datos de la organización" />
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <InfoRow label="Plan" value={<span className="capitalize">{org.plan ?? '—'}</span>} />
          <InfoRow label="Precio" value={org.plan_price_usd > 0 ? `USD ${org.plan_price_usd}/mes` : '—'} />
          <InfoRow
            label="Trial hasta"
            value={org.trial_ends_at
              ? new Date(org.trial_ends_at).toLocaleDateString('es-AR')
              : '—'}
          />
          <InfoRow
            label="Registro"
            value={new Date(org.created_at).toLocaleDateString('es-AR')}
          />
          {org.website && (
            <InfoRow
              label="Website"
              value={
                <a href={org.website} target="_blank" rel="noreferrer"
                  className="text-brand hover:underline flex items-center gap-1">
                  {org.website} <ExternalLink className="h-3 w-3" />
                </a>
              }
            />
          )}
          {org.office_phone && <InfoRow label="Teléfono" value={org.office_phone} />}
          {org.office_address && <InfoRow label="Dirección" value={org.office_address} />}
        </div>

        {(org.billing_razon_social || org.billing_cuit || org.billing_email) && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wide">Datos fiscales</p>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {org.billing_razon_social && <InfoRow label="Razón social" value={org.billing_razon_social} />}
              {org.billing_cuit        && <InfoRow label="CUIT"          value={org.billing_cuit} />}
              {org.billing_email       && <InfoRow label="Email fact."   value={org.billing_email} />}
              {org.billing_address     && <InfoRow label="Dirección fiscal" value={org.billing_address} />}
              {org.billing_contact     && <InfoRow label="Contacto fact." value={org.billing_contact} />}
              {org.billing_phone       && <InfoRow label="Tel. fact."     value={org.billing_phone} />}
            </div>
          </div>
        )}
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Users}    label="Usuarios"    value={users.length} />
        <StatCard icon={Package}  label="Inventario"  value={invCount} />
        <StatCard icon={FileText} label="Propuestas"  value={propCount} />
      </div>

      {/* Usuarios */}
      <Card>
        <CardHeader title={`Usuarios (${users.length})`} />
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between rounded-lg bg-surface-700/50 px-3 py-2.5 text-sm">
              <div>
                <p className="font-medium text-white">{u.full_name ?? '—'}</p>
                <p className="text-xs text-slate-500 font-mono">{u.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <RoleBadge role={u.role} />
                {!u.is_active && (
                  <span className="text-xs text-slate-600">Inactivo</span>
                )}
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center">Sin usuarios registrados.</p>
          )}
        </div>
      </Card>

      {/* Tickets de soporte */}
      <Card>
        <CardHeader title={`Tickets de soporte (${tickets.length})`} />
        {tickets.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">Sin tickets.</p>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => (
              <div key={t.id} className="flex items-start justify-between rounded-lg bg-surface-700/50 px-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-white">{t.subject}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <TicketStatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Notas internas */}
      <Card>
        <CardHeader title="Notas internas" subtitle="Solo visible para el equipo de administración" />
        <textarea
          className="input-field w-full min-h-[100px] resize-y text-sm"
          placeholder="Agregar notas sobre esta empresa…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={handleSaveNotes} loading={savingNotes} size="sm">
            <Save className="h-4 w-4 mr-1.5" />
            Guardar notas
          </Button>
          {savedNotes && <span className="text-sm text-teal-400">✓ Guardado</span>}
        </div>
      </Card>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <span className="text-xs text-slate-500 block">{label}</span>
      <span className="text-slate-200 font-medium">{value ?? '—'}</span>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <Card className="text-center">
      <Icon className="h-5 w-5 text-brand mx-auto mb-1" />
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </Card>
  )
}

function TicketStatusBadge({ status }) {
  const colors = {
    open:        'bg-blue-500/20 text-blue-400',
    in_progress: 'bg-amber-500/20 text-amber-400',
    resolved:    'bg-teal-500/20 text-teal-400',
    closed:      'bg-slate-500/20 text-slate-400',
  }
  const labels = { open: 'Abierto', in_progress: 'En proceso', resolved: 'Resuelto', closed: 'Cerrado' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? colors.open}`}>
      {labels[status] ?? status}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const colors = {
    low:    'text-slate-500',
    normal: 'text-slate-400',
    high:   'text-amber-400',
    urgent: 'text-red-400',
  }
  const labels = { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' }
  return (
    <span className={`text-xs font-medium ${colors[priority] ?? colors.normal}`}>
      {labels[priority] ?? priority}
    </span>
  )
}
