import { useState, useRef } from 'react'
import { Shield, Lock, Eye, Building2, Upload, X, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card, { CardHeader } from '../../components/ui/Card'
import { RoleBadge } from '../../components/ui/Badge'
import { getInitials } from '../../lib/utils'

function SaveRow({ loading, saved, children }) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" loading={loading}>{children ?? 'Guardar cambios'}</Button>
      {saved && <span className="text-sm text-emerald-400">✓ Guardado</span>}
    </div>
  )
}

export default function Settings() {
  const { profile, org, user, isOwner, isManager, refreshProfile } = useAuth()

  // ── Perfil personal ──
  const [name, setName]             = useState(profile?.full_name ?? '')
  const [phone, setPhone]           = useState(profile?.phone ?? '')
  const [address, setAddress]       = useState(profile?.address ?? '')
  const [officeHours, setOfficeHours] = useState(profile?.office_hours ?? '')
  const [bio, setBio]               = useState(profile?.bio ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savedProfile, setSavedProfile]   = useState(false)

  // ── Org — info general ──
  const [orgName, setOrgName]         = useState(org?.name ?? '')
  const [orgPhone, setOrgPhone]       = useState(org?.office_phone ?? '')
  const [orgAddress, setOrgAddress]   = useState(org?.office_address ?? '')
  const [orgHours, setOrgHours]       = useState(org?.office_hours ?? '')
  const [website, setWebsite]         = useState(org?.website ?? '')
  const [savingOrg, setSavingOrg]     = useState(false)
  const [savedOrg, setSavedOrg]       = useState(false)

  // ── Org — datos fiscales ──
  const [cuit, setCuit]                 = useState(org?.billing_cuit ?? '')
  const [razonSocial, setRazonSocial]   = useState(org?.billing_razon_social ?? '')
  const [billingAddr, setBillingAddr]   = useState(org?.billing_address ?? '')
  const [billingEmail, setBillingEmail] = useState(org?.billing_email ?? '')
  const [billingContact, setBillingContact] = useState(org?.billing_contact ?? '')
  const [billingPhone, setBillingPhone] = useState(org?.billing_phone ?? '')
  const [savingBilling, setSavingBilling] = useState(false)
  const [savedBilling, setSavedBilling]   = useState(false)

  // ── Logo ──
  const fileRef = useRef(null)
  const [logoPreview, setLogoPreview] = useState(org?.logo_url ?? null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // ── Artworks para mockup ──
  const [artH, setArtH]   = useState(org?.artwork_h_url ?? null)
  const [artV, setArtV]   = useState(org?.artwork_v_url ?? null)
  const [artSq, setArtSq] = useState(org?.artwork_sq_url ?? null)
  const [uploadingArt, setUploadingArt] = useState(null) // 'h' | 'v' | 'sq' | null

  // ── Descuentos ──
  const [maxSales, setMaxSales]     = useState(org?.max_discount_salesperson ?? 20)
  const [maxMgr, setMaxMgr]         = useState(org?.max_discount_manager ?? 30)
  const [savingDisc, setSavingDisc] = useState(false)
  const [savedDisc, setSavedDisc]   = useState(false)

  const canEditOrg = isOwner || isManager

  // ── Handlers ──

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSavingProfile(true)
    await supabase
      .from('profiles')
      .update({ full_name: name, phone, address, office_hours: officeHours, bio })
      .eq('id', profile.id)
    await refreshProfile()
    setSavingProfile(false)
    setSavedProfile(true)
    setTimeout(() => setSavedProfile(false), 3000)
  }

  async function handleSaveOrg(e) {
    e.preventDefault()
    setSavingOrg(true)
    await supabase
      .from('organisations')
      .update({
        name: orgName,
        office_phone: orgPhone,
        office_address: orgAddress,
        office_hours: orgHours,
        website,
      })
      .eq('id', org.id)
    await refreshProfile()
    setSavingOrg(false)
    setSavedOrg(true)
    setTimeout(() => setSavedOrg(false), 3000)
  }

  async function handleSaveBilling(e) {
    e.preventDefault()
    setSavingBilling(true)
    await supabase
      .from('organisations')
      .update({
        billing_cuit: cuit,
        billing_razon_social: razonSocial,
        billing_address: billingAddr,
        billing_email: billingEmail,
        billing_contact: billingContact,
        billing_phone: billingPhone,
      })
      .eq('id', org.id)
    await refreshProfile()
    setSavingBilling(false)
    setSavedBilling(true)
    setTimeout(() => setSavedBilling(false), 3000)
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    const ext = file.name.split('.').pop()
    const path = `${org.id}/logo.${ext}`

    const { error: upErr } = await supabase.storage
      .from('org-logos')
      .upload(path, file, { upsert: true })

    if (upErr) {
      console.error('Logo upload error:', upErr.message)
      setUploadingLogo(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('org-logos')
      .getPublicUrl(path)

    await supabase
      .from('organisations')
      .update({ logo_url: publicUrl })
      .eq('id', org.id)

    setLogoPreview(publicUrl)
    await refreshProfile()
    setUploadingLogo(false)
  }

  async function handleRemoveLogo() {
    await supabase
      .from('organisations')
      .update({ logo_url: null })
      .eq('id', org.id)
    setLogoPreview(null)
    await refreshProfile()
  }

  async function handleArtworkUpload(slot, file) {
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('Solo PNG o JPG')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Máximo 2MB por imagen')
      return
    }

    setUploadingArt(slot)
    const ext = file.name.split('.').pop()
    const path = `${org.id}/artwork_${slot}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('org-artwork')
      .upload(path, file, { upsert: true })

    if (upErr) {
      console.error('Artwork upload error:', upErr.message)
      setUploadingArt(null)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('org-artwork')
      .getPublicUrl(path)

    const url = publicUrl + '?t=' + Date.now()

    const col = slot === 'h' ? 'artwork_h_url'
              : slot === 'v' ? 'artwork_v_url'
              : 'artwork_sq_url'

    await supabase
      .from('organisations')
      .update({ [col]: url })
      .eq('id', org.id)

    if (slot === 'h') setArtH(url)
    else if (slot === 'v') setArtV(url)
    else setArtSq(url)

    await refreshProfile()
    setUploadingArt(null)
  }

  async function handleRemoveArtwork(slot) {
    const col = slot === 'h' ? 'artwork_h_url'
              : slot === 'v' ? 'artwork_v_url'
              : 'artwork_sq_url'

    await supabase
      .from('organisations')
      .update({ [col]: null })
      .eq('id', org.id)

    if (slot === 'h') setArtH(null)
    else if (slot === 'v') setArtV(null)
    else setArtSq(null)

    await refreshProfile()
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

      {/* ── Mi perfil ── */}
      <Card>
        <CardHeader title="Mi perfil" />
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/20 text-lg font-bold text-brand">
            {getInitials(profile?.full_name)}
          </div>
          <div>
            <p className="font-semibold text-white">{profile?.full_name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
            <div className="mt-1">
              <RoleBadge role={profile?.role} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Nombre completo"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input
              className="input-field w-full opacity-60 cursor-not-allowed"
              value={user?.email ?? ''}
              readOnly
              disabled
            />
            <p className="mt-1 text-xs text-slate-600">El email se gestiona desde tu proveedor de autenticación.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Teléfono de contacto"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+54 11 1234-5678"
            />
            <Input
              label="Dirección de oficina"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Av. Corrientes 1234, CABA"
            />
          </div>
          <Input
            label="Horarios de atención"
            value={officeHours}
            onChange={e => setOfficeHours(e.target.value)}
            placeholder="Lun–Vie 9:00–18:00"
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Bio / presentación</label>
            <textarea
              className="input-field w-full resize-none"
              rows={3}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Especialista en planificación OOH con 5 años de experiencia…"
            />
          </div>
          <SaveRow loading={savingProfile} saved={savedProfile} />
        </form>
      </Card>

      {/* ── Empresa (solo owner/manager) ── */}
      {canEditOrg && (
        <>
          {/* Logo */}
          <Card>
            <CardHeader title="Logo de empresa" subtitle="Se mostrará en las propuestas generadas" />
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-700 bg-surface-700 flex items-center justify-center">
                  <img src={logoPreview} alt="Logo empresa" className="h-full w-full object-contain p-1" />
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute top-1 right-1 rounded-full bg-slate-900/80 p-0.5 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="h-20 w-20 rounded-xl border border-dashed border-slate-700 bg-surface-700 flex items-center justify-center text-slate-600">
                  <Building2 className="h-8 w-8" />
                </div>
              )}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button
                  onClick={() => fileRef.current?.click()}
                  loading={uploadingLogo}
                  size="sm"
                  variant="secondary"
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  {logoPreview ? 'Cambiar logo' : 'Subir logo'}
                </Button>
                <p className="mt-1.5 text-xs text-slate-600">PNG o SVG recomendado. Máx. 2MB.</p>
              </div>
            </div>
          </Card>

          {/* Artworks para mockups */}
          <Card>
            <CardHeader
              title="Artes genéricos para mockups"
              subtitle="Se usan como fallback cuando el vendedor no sube arte del cliente. Máx. 2MB, solo PNG/JPG."
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { key: 'h',  label: 'Horizontal', aspect: '16:9', icon: '📺', state: artH,  ratio: 'aspect-video' },
                { key: 'v',  label: 'Vertical',   aspect: '9:16', icon: '📱', state: artV,  ratio: 'aspect-[9/16]' },
                { key: 'sq', label: 'Cuadrado',   aspect: '1:1',  icon: '🟦', state: artSq, ratio: 'aspect-square' },
              ].map(({ key, label, aspect, icon, state, ratio }) => (
                <div key={key} className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-slate-400 text-center">
                    {icon} {label} ({aspect})
                  </p>

                  {state ? (
                    <>
                      <div className="relative rounded-lg overflow-hidden border border-surface-700 bg-surface-700">
                        <div className={ratio + ' w-full'}>
                          <img src={state} alt={label} className="absolute inset-0 w-full h-full object-cover" />
                        </div>
                        <button
                          onClick={() => handleRemoveArtwork(key)}
                          className="absolute top-1 right-1 rounded-full bg-slate-900/80 p-0.5 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <label className="cursor-pointer text-center">
                        <span className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
                          Cambiar
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          className="hidden"
                          onChange={e => { handleArtworkUpload(key, e.target.files?.[0]); e.target.value = '' }}
                        />
                      </label>
                    </>
                  ) : (
                    <label className="cursor-pointer">
                      <div className={ratio + ' w-full rounded-lg border-2 border-dashed border-surface-600 bg-surface-800/30 flex flex-col items-center justify-center gap-1 hover:border-brand/40 transition-colors'}>
                        {uploadingArt === key
                          ? <Loader2 className="h-6 w-6 animate-spin text-brand" />
                          : <>
                              <Upload className="h-5 w-5 text-slate-600" />
                              <span className="text-xs text-slate-500">Subir</span>
                            </>
                        }
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={e => { handleArtworkUpload(key, e.target.files?.[0]); e.target.value = '' }}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Info empresa */}
          <Card>
            <CardHeader title="Datos de la empresa" />
            <form onSubmit={handleSaveOrg} className="space-y-4">
              <Input
                label="Nombre de empresa"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Teléfono"
                  type="tel"
                  value={orgPhone}
                  onChange={e => setOrgPhone(e.target.value)}
                  placeholder="+54 11 1234-5678"
                />
                <Input
                  label="Website"
                  type="url"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://empresa.com"
                />
              </div>
              <Input
                label="Dirección de oficina"
                value={orgAddress}
                onChange={e => setOrgAddress(e.target.value)}
                placeholder="Av. Corrientes 1234, CABA"
              />
              <Input
                label="Horarios de atención"
                value={orgHours}
                onChange={e => setOrgHours(e.target.value)}
                placeholder="Lun–Vie 9:00–18:00"
              />
              <SaveRow loading={savingOrg} saved={savedOrg} />
            </form>
          </Card>

          {/* Datos fiscales */}
          <Card>
            <CardHeader title="Datos fiscales" subtitle="Para facturación y documentación legal" />
            <form onSubmit={handleSaveBilling} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="CUIT / CUIL"
                  value={cuit}
                  onChange={e => setCuit(e.target.value)}
                  placeholder="20-12345678-9"
                />
                <Input
                  label="Razón social"
                  value={razonSocial}
                  onChange={e => setRazonSocial(e.target.value)}
                  placeholder="Empresa S.A."
                />
              </div>
              <Input
                label="Dirección fiscal"
                value={billingAddr}
                onChange={e => setBillingAddr(e.target.value)}
                placeholder="Av. Corrientes 1234, CABA"
              />
              <Input
                label="Email de facturación"
                type="email"
                value={billingEmail}
                onChange={e => setBillingEmail(e.target.value)}
                placeholder="facturacion@empresa.com"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Contacto de facturación"
                  value={billingContact}
                  onChange={e => setBillingContact(e.target.value)}
                  placeholder="María García"
                />
                <Input
                  label="Teléfono de facturación"
                  type="tel"
                  value={billingPhone}
                  onChange={e => setBillingPhone(e.target.value)}
                  placeholder="+54 11 1234-5678"
                />
              </div>
              <SaveRow loading={savingBilling} saved={savedBilling} />
            </form>
          </Card>
        </>
      )}

      {/* ── Límites de descuento (solo owner) ── */}
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
                    className="input-field pr-8 w-full"
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
                    className="input-field pr-8 w-full"
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
              "Esperando aprobación" hasta que un manager u owner la apruebe.
            </p>
            <SaveRow loading={savingDisc} saved={savedDisc}>Guardar límites</SaveRow>
          </form>
        </Card>
      )}

      {/* ── Privacidad y seguridad ── */}
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
          <SecurityItem icon={Lock} color="blue" title="Aislamiento por organización">
            Todos los datos de tu empresa están aislados por{' '}
            <code className="rounded bg-surface-700 px-1 text-slate-400">org_id</code>. Ningún
            usuario de otra organización puede acceder a tu información.
          </SecurityItem>
          <SecurityItem icon={Eye} color="purple" title="Acceso solo para tu empresa">
            OOH Planner usa Row Level Security (RLS) de Supabase: las políticas de acceso se
            aplican a nivel de base de datos, no solo en el servidor de aplicación.
          </SecurityItem>
          <SecurityItem icon={Building2} color="emerald" title="Encriptación en tránsito y en reposo">
            Toda la comunicación usa HTTPS/TLS. Los datos están encriptados en reposo (AES-256).
            Tus credenciales nunca son almacenadas en texto plano.
          </SecurityItem>
        </div>
      </Card>
    </div>
  )
}

function SecurityItem({ icon: Icon, color, title, children }) {
  const colors = {
    blue:   'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
  }
  return (
    <div className="flex gap-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="font-medium text-white">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{children}</p>
      </div>
    </div>
  )
}
