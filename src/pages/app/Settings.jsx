import { useState } from 'react'
import { Shield, Lock, Eye, Building2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card, { CardHeader } from '../../components/ui/Card'
import { RoleBadge } from '../../components/ui/Badge'
import { getInitials } from '../../lib/utils'

export default function Settings() {
  const { profile, org, isOwner, refreshProfile } = useAuth()
  const [name, setName]             = useState(profile?.full_name ?? '')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [maxSales, setMaxSales]     = useState(org?.max_discount_salesperson ?? 20)
  const [maxMgr, setMaxMgr]         = useState(org?.max_discount_manager ?? 30)
  const [savingDisc, setSavingDisc] = useState(false)
  const [savedDisc, setSavedDisc]   = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('profiles').update({ full_name: name }).eq('id', profile.id)
    await refreshProfile()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleSaveDiscounts(e) {
    e.preventDefault()
    setSavingDisc(true)
    await supabase
      .from('organisations')
      .update({
        max_discount_salesperson: Math.min(100, Math.max(0, Number(maxSales))),
        max_discount_manager:     Math.min(100, Math.max(0, Number(maxMgr))),
      })
      .eq('id', org.id)
    await refreshProfile()
    setSavingDisc(false)
    setSavedDisc(true)
    setTimeout(() => setSavedDisc(false), 3000)
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-white">Ajustes</h2>
        <p className="text-sm text-slate-500">Gestiona tu perfil y preferencias</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader title="Perfil personal" />
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/20 text-lg font-bold text-brand">
            {getInitials(profile?.full_name)}
          </div>
          <div>
            <p className="font-semibold text-white">{profile?.full_name}</p>
            <div className="mt-1">
              <RoleBadge role={profile?.role} />
            </div>
          </div>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nombre completo"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>Guardar cambios</Button>
            {saved && <span className="text-sm text-emerald-400">✓ Guardado</span>}
          </div>
        </form>
      </Card>

      {/* Org info */}
      <Card>
        <CardHeader title="Mi organización" />
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Nombre</span>
            <span className="text-slate-200 font-medium">{org?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Plan</span>
            <span className="text-slate-200 font-medium capitalize">{org?.plan}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Slug</span>
            <span className="text-slate-400 font-mono text-xs">{org?.slug}</span>
          </div>
        </div>
      </Card>

      {/* Descuentos máximos — solo owner */}
      {isOwner && (
        <Card>
          <CardHeader
            title="Límites de descuento"
            subtitle="Máximo descuento que cada rol puede aplicar sin requerir aprobación"
          />
          <form onSubmit={handleSaveDiscounts} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Vendedor (salesperson)
                </label>
                <div className="relative">
                  <input
                    type="number" min="0" max="100" step="1"
                    className="input-field pr-8"
                    value={maxSales}
                    onChange={e => setMaxSales(Number(e.target.value))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">Default: 20%</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Gerente (manager)
                </label>
                <div className="relative">
                  <input
                    type="number" min="0" max="100" step="1"
                    className="input-field pr-8"
                    value={maxMgr}
                    onChange={e => setMaxMgr(Number(e.target.value))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">Default: 30%</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Owner: sin límite (100%). Si un vendedor supera su límite, la propuesta queda en estado
              "Esperando aprobación" hasta que un manager u owner la apruebe desde la lista de propuestas.
            </p>
            <div className="flex items-center gap-3">
              <Button type="submit" loading={savingDisc}>Guardar límites</Button>
              {savedDisc && <span className="text-sm text-emerald-400">✓ Guardado</span>}
            </div>
          </form>
        </Card>
      )}

      {/* Privacidad y seguridad */}
      <Card>
        <CardHeader
          title="Privacidad y seguridad"
          action={
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <Shield className="h-3 w-3" />
              Protegido
            </div>
          }
        />
        <div className="space-y-4 text-sm">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <Lock className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-white">Aislamiento por organización</p>
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                Todos los datos de tu empresa (inventario, propuestas, campañas, equipo) están aislados
                por <code className="rounded bg-surface-700 px-1 text-slate-400">org_id</code>. Ningún
                usuario de otra organización puede acceder a tu información, incluso si usa la misma plataforma.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
              <Eye className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <p className="font-medium text-white">Acceso solo para tu empresa</p>
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                OOH Planner no accede a tus datos operativos. La plataforma usa Row Level Security (RLS)
                de Supabase: las políticas de acceso se aplican a nivel de base de datos, no solo en el
                servidor de aplicación.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <Building2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="font-medium text-white">Encriptación en tránsito y en reposo</p>
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                Toda la comunicación usa HTTPS/TLS. Los datos en la base de datos están encriptados
                en reposo por Supabase (AES-256). Tus credenciales nunca son almacenadas en texto plano.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
