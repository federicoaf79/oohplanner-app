import { useState, useRef, useEffect } from 'react'
import { validateArtwork } from '../../lib/validateArtwork'
import { Shield, Lock, Eye, Building2, Upload, X, Loader2, MoreVertical, BookOpen } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import ContactFormModal from '../../features/contacts/ContactFormModal'
import Input from '../../components/ui/Input'
import Card, { CardHeader } from '../../components/ui/Card'
import { RoleBadge } from '../../components/ui/Badge'
import { getInitials } from '../../lib/utils'

function SaveRow({ loading, saved, children }) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" loading={loading}>{children ?? 'Guardar cambios'}</Button>
      {saved && <span className="text-sm text-teal-400">✓ Guardado</span>}
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
  const [resettingTutorial, setResettingTutorial] = useState(false)
  const [tutorialReset, setTutorialReset]         = useState(false)

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
  const [artError, setArtError] = useState(null) // { slot, message }

  // ── Contactos confidenciales ──
  const [confidentialContacts, setConfidentialContacts]       = useState([])
  const [loadingConfidential, setLoadingConfidential]         = useState(false)
  const [editingConfidentialContact, setEditingConfidentialContact] = useState(null)
  const [confirmMakePublic, setConfirmMakePublic]             = useState(null)
  const [confirmDeleteConfidential, setConfirmDeleteConfidential] = useState(null)
  const [openConfidentialMenu, setOpenConfidentialMenu]       = useState(null)

  const canEditOrg = isOwner || isManager

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState(canEditOrg ? 'company' : 'profile')
  // Note: the 'confidential_contacts' and 'confidential_reports' tab content
  // blocks remain further down this file as unreachable dead code pending
  // migration to /app/inventory-settings. Do not delete without moving the logic.
  // ('team' and 'commercial' have already been migrated.)
  const tabs = [
    { id: 'company',  label: 'Empresa',              visible: canEditOrg },
    { id: 'profile',  label: 'Mi Perfil de Usuario', visible: true       },
    { id: 'security', label: 'Privacidad y seguridad', visible: true     },
  ].filter(t => t.visible)

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

  async function handleResetTutorial() {
    setResettingTutorial(true)
    await supabase.from('profiles').update({ onboarding_tutorial_seen: false }).eq('id', profile.id)
    await refreshProfile()
    setResettingTutorial(false)
    setTutorialReset(true)
    setTimeout(() => setTutorialReset(false), 3000)
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
    setArtError(null)

    const result = await validateArtwork(file, slot)
    if (!result.valid) {
      setArtError({ slot, message: result.error })
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
    setArtError(null)
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

  // ── Contactos confidenciales: cargar al entrar al tab ──
  useEffect(() => {
    if (activeTab !== 'confidential_contacts' || !isOwner) return
    loadConfidentialContacts()
  }, [activeTab, isOwner, org.id])

  async function loadConfidentialContacts() {
    setLoadingConfidential(true)
    const { data } = await supabase
      .from('contacts')
      .select(`
        id, name, legal_name, roles, email, phone, is_active,
        agreements:facilitator_agreements!facilitator_agreements_contact_id_fkey(
          id, is_active
        )
      `)
      .eq('org_id', org.id)
      .eq('visibility', 'owner_only')
      .order('name')
    setConfidentialContacts(data ?? [])
    setLoadingConfidential(false)
  }

  async function handleMakePublic(contact) {
    await supabase.from('contacts').update({ visibility: 'company_wide' }).eq('id', contact.id)
    setConfirmMakePublic(null)
    loadConfidentialContacts()
  }

  async function handleDeleteConfidential(contact) {
    const activeAgreements = contact.agreements?.filter(a => a.is_active) ?? []
    if (activeAgreements.length > 0) {
      alert(`No se puede eliminar. Este contacto tiene ${activeAgreements.length} acuerdo(s) activo(s). Desactivá o desvinculá los acuerdos primero desde Reglas comerciales.`)
      setConfirmDeleteConfidential(null)
      return
    }
    await supabase.from('contacts').delete().eq('id', contact.id)
    setConfirmDeleteConfidential(null)
    loadConfidentialContacts()
  }

  function fmtDate(str) {
    if (!str) return '—'
    return new Date(str + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">Ajustes</h2>
        <p className="text-sm text-slate-500">Gestiona tu perfil y preferencias</p>
      </div>

      {/* ── Pill tabs ── */}
      <div className="flex flex-wrap gap-2 border-b border-surface-700 pb-3 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-brand text-white'
                : 'bg-surface-800 text-slate-400 hover:bg-surface-700 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="space-y-6">

        {/* TAB 1 — Mi perfil */}
        {activeTab === 'profile' && (
          <div className="space-y-5">
          <Card>
            <CardHeader title="Mi Perfil de Usuario" />
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

          <Card>
            <CardHeader title="Tutorial de bienvenida" />
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15">
                <BookOpen className="h-5 w-5 text-brand" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-300">
                  Volvé a ver el tutorial de introducción a OOH Planner en cualquier momento.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  El wizard te guía por las funcionalidades principales de la plataforma.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    onClick={handleResetTutorial}
                    loading={resettingTutorial}
                    size="sm"
                    variant="secondary"
                  >
                    Ver tutorial nuevamente
                  </Button>
                  {tutorialReset && (
                    <span className="text-xs text-teal-400">✓ Se mostrará al recargar</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
          </div>
        )}

        {/* TAB 2 — Empresa */}
        {activeTab === 'company' && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">

            {/* Columna IZQUIERDA — datos */}
            <div className="space-y-5 md:space-y-6">

              {/* Datos de la empresa */}
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
            </div>

            {/* Columna DERECHA — assets de marca */}
            <div className="space-y-5 md:space-y-6">

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

              {/* Artes genéricos para mockups */}
              <Card>
                <CardHeader
                  title="Artes genéricos para mockups"
                  subtitle="Se usan como fallback cuando el vendedor no sube arte del cliente. Máx. 2MB, solo PNG/JPG."
                />
                {artError && (
                  <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                    <svg className="h-4 w-4 text-red-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p className="text-xs text-red-300 leading-relaxed">{artError.message}</p>
                  </div>
                )}
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
            </div>

          </div>
        )}

        {/* Modales — Contactos confidenciales */}
        {editingConfidentialContact && (
          <ContactFormModal
            contact={editingConfidentialContact}
            onClose={() => setEditingConfidentialContact(null)}
            onSaved={() => { setEditingConfidentialContact(null); loadConfidentialContacts() }}
          />
        )}

        {confirmMakePublic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-surface-800 p-6 shadow-2xl">
              <h3 className="mb-2 font-semibold text-white">Hacer contacto público</h3>
              <p className="mb-6 text-sm text-slate-400">
                ¿Querés que todos los miembros de la empresa puedan ver a{' '}
                <strong className="text-slate-200">"{confirmMakePublic.name}"</strong>?
                Esta acción lo saca del listado confidencial.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmMakePublic(null)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={() => handleMakePublic(confirmMakePublic)}
                  className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
                >
                  Hacer público
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmDeleteConfidential && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-surface-800 p-6 shadow-2xl">
              <h3 className="mb-2 font-semibold text-white">Eliminar contacto</h3>
              <p className="mb-6 text-sm text-slate-400">
                ¿Estás seguro de eliminar a{' '}
                <strong className="text-slate-200">"{confirmDeleteConfidential.name}"</strong>?
                Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteConfidential(null)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={() => handleDeleteConfidential(confirmDeleteConfidential)}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5 — Contactos confidenciales */}
        {activeTab === 'confidential_contacts' && (
          <Card>
            <CardHeader
              title="Contactos confidenciales"
              subtitle="Contactos visibles solo para vos. Incluye facilitadores encubiertos y cualquier contacto marcado como reservado."
            />
            {loadingConfidential ? (
              <div className="py-12 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand" />
              </div>
            ) : confidentialContacts.length === 0 ? (
              <div className="py-12 text-center">
                <Lock className="mx-auto h-8 w-8 text-slate-600 mb-3" />
                <p className="text-slate-400">Aún no hay contactos confidenciales</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Los contactos que marques como "Solo yo lo veo" aparecen acá.
                  Podés marcarlos desde Contactos o al crear un acuerdo nuevo.
                </p>
              </div>
            ) : (
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-700 text-xs uppercase text-slate-500">
                      <th className="px-4 py-3 text-left font-medium">Nombre</th>
                      <th className="px-4 py-3 text-left font-medium">Roles</th>
                      <th className="px-4 py-3 text-left font-medium">Acuerdos</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800">
                    {confidentialContacts.map(c => {
                      const activeAgreements = c.agreements?.filter(a => a.is_active).length ?? 0
                      const totalAgreements  = c.agreements?.length ?? 0
                      const menuOpen = openConfidentialMenu === c.id
                      return (
                        <tr key={c.id} className="hover:bg-surface-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                              <div>
                                <p className="font-medium text-slate-100">{c.name}</p>
                                {c.legal_name && <p className="text-xs text-slate-500">{c.legal_name}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {c.roles && c.roles.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {c.roles.slice(0, 2).map(r => (
                                  <span key={r} className="rounded-full bg-surface-700 px-2 py-0.5 text-xs text-slate-300">{r}</span>
                                ))}
                                {c.roles.length > 2 && (
                                  <span className="text-xs text-slate-500">+{c.roles.length - 2}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs italic text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {totalAgreements === 0 ? (
                              <span className="text-xs text-slate-500">—</span>
                            ) : (
                              <span className="text-sm text-slate-300">
                                {activeAgreements} activo{activeAgreements === 1 ? '' : 's'}
                                {totalAgreements > activeAgreements && (
                                  <span className="text-xs text-slate-500 ml-1">
                                    · {totalAgreements - activeAgreements} inactivo{(totalAgreements - activeAgreements) === 1 ? '' : 's'}
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="relative flex justify-end">
                              <button
                                onClick={() => setOpenConfidentialMenu(v => v === c.id ? null : c.id)}
                                className="rounded-md p-1 text-slate-500 hover:bg-surface-700 hover:text-slate-300 transition-colors"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                              {menuOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setOpenConfidentialMenu(null)} />
                                  <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-surface-700 bg-surface-800 py-1 shadow-xl">
                                    <button
                                      onClick={() => { setOpenConfidentialMenu(null); setEditingConfidentialContact(c) }}
                                      className="flex w-full items-center px-3 py-2 text-sm text-slate-300 hover:bg-surface-700"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => { setOpenConfidentialMenu(null); setConfirmMakePublic(c) }}
                                      className="flex w-full items-center px-3 py-2 text-sm text-slate-300 hover:bg-surface-700"
                                    >
                                      Hacer público
                                    </button>
                                    <button
                                      onClick={() => { setOpenConfidentialMenu(null); setConfirmDeleteConfidential(c) }}
                                      className="flex w-full items-center px-3 py-2 text-sm text-rose-400 hover:bg-surface-700"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* TAB 6 — Reportes confidenciales (placeholder) */}
        {activeTab === 'confidential_reports' && (
          <Card>
            <CardHeader title="Reportes confidenciales" />
            <div className="text-center py-12 text-slate-500">
              <p>Próximamente</p>
              <p className="text-xs mt-2">Rentabilidad global, por cartel, por facilitador y por vendedor</p>
            </div>
          </Card>
        )}

        {/* TAB 7 — Privacidad y seguridad */}
        {activeTab === 'security' && (
          <Card>
            <CardHeader
              title="Privacidad y seguridad"
              action={
                <div className="flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-400">
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
        )}

      </div>
    </div>
  )
}

function SecurityItem({ icon: Icon, color, title, children }) {
  const colors = {
    blue:   'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    emerald: 'bg-teal-500/10 text-teal-400',
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
