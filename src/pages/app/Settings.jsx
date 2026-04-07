import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card, { CardHeader } from '../../components/ui/Card'
import { RoleBadge } from '../../components/ui/Badge'
import { getInitials } from '../../lib/utils'

export default function Settings() {
  const { profile, org, refreshProfile } = useAuth()
  const [name, setName]     = useState(profile?.full_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('profiles').update({ full_name: name }).eq('id', profile.id)
    await refreshProfile()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
            <Button type="submit" loading={saving}>
              Guardar cambios
            </Button>
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
    </div>
  )
}
