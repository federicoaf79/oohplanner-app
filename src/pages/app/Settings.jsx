import { useState, useRef, useEffect, useMemo, Fragment } from 'react'
import { validateArtwork } from '../../lib/validateArtwork'
import { Shield, Lock, Eye, Building2, Upload, X, Loader2, ChevronRight, MoreVertical, BookOpen } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import NewFacilitatorAgreementWizard from '../../features/commissions/NewFacilitatorAgreementWizard'
import AgreementDetailPanel from '../../features/commissions/AgreementDetailPanel'
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

  // ── Descuentos ──
  const [maxSales, setMaxSales]     = useState(org?.max_discount_salesperson ?? 20)
  const [maxMgr, setMaxMgr]         = useState(org?.max_discount_manager ?? 30)
  const [savingDisc, setSavingDisc] = useState(false)
  const [savedDisc, setSavedDisc]   = useState(false)

  // ── Acuerdos con facilitadores ──
  const [agreements, setAgreements]               = useState([])
  const [loadingAgreements, setLoadingAgreements] = useState(false)
  const [showAgreementWizard, setShowAgreementWizard] = useState(false)
  const [selectedAgreement, setSelectedAgreement] = useState(null)

  // ── Contactos confidenciales ──
  const [confidentialContacts, setConfidentialContacts]       = useState([])
  const [loadingConfidential, setLoadingConfidential]         = useState(false)
  const [editingConfidentialContact, setEditingConfidentialContact] = useState(null)
  const [confirmMakePublic, setConfirmMakePublic]             = useState(null)
  const [confirmDeleteConfidential, setConfirmDeleteConfidential] = useState(null)
  const [openConfidentialMenu, setOpenConfidentialMenu]       = useState(null)

  // ── Equipo y comisiones ──
  const [teamMembers, setTeamMembers]               = useState([])
  const [loadingTeam, setLoadingTeam]               = useState(false)
  const [sellersSeeCommission, setSellersSeeCommission] = useState(org?.sellers_see_own_commission ?? false)
  const [savingMember, setSavingMember]             = useState(null) // userId guardando
  const [savedMember, setSavedMember]               = useState(null) // userId con checkmark
  const commDebounceRef                             = useRef({})     // { [userId]: timeoutId }

  const canEditOrg = isOwner || isManager

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState(canEditOrg ? 'company' : 'profile')
  const tabs = [
    { id: 'company',               label: 'Empresa',                   visible: canEditOrg  },
    { id: 'team',                  label: 'Equipo y comisiones',       visible: isOwner     },
    { id: 'commercial',            label: 'Reglas comerciales',        visible: isOwner     },
    { id: 'profile',               label: 'Mi perfil',                 visible: true        },
    { id: 'confidential_contacts', label: 'Contactos confidenciales',  visible: isOwner     },
    { id: 'confidential_reports',  label: 'Reportes confidenciales',   visible: isOwner     },
    { id: 'security',              label: 'Privacidad y seguridad',    visible: true        },
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

  // ── Equipo: cargar al entrar al tab ──
  useEffect(() => {
    if (activeTab !== 'team' || !isOwner) return
    setLoadingTeam(true)
    supabase.from('profiles')
      .select('id, full_name, role, commission_pct, is_supervisor, supervisor_commission_pct, supervisor_id')
      .eq('org_id', org.id)
      .order('role', { ascending: true })
      .order('full_name', { ascending: true })
      .then(({ data }) => {
        setTeamMembers(data ?? [])
        setLoadingTeam(false)
      })
  }, [activeTab, isOwner, org.id])

  function handleCommissionChange(userId, newPct) {
    // Actualizar local inmediato
    setTeamMembers(ms => ms.map(m => m.id === userId ? { ...m, commission_pct: newPct } : m))
    // Cancelar debounce previo para este usuario
    clearTimeout(commDebounceRef.current[userId])
    commDebounceRef.current[userId] = setTimeout(async () => {
      setSavingMember(userId)
      const { error } = await supabase.from('profiles')
        .update({ commission_pct: Number(newPct) })
        .eq('id', userId)
      setSavingMember(null)
      if (error) {
        // Revertir al valor anterior recargando
        supabase.from('profiles').select('commission_pct').eq('id', userId).single()
          .then(({ data }) => {
            if (data) setTeamMembers(ms => ms.map(m => m.id === userId ? { ...m, commission_pct: data.commission_pct } : m))
          })
      } else {
        setSavedMember(userId)
        setTimeout(() => setSavedMember(v => v === userId ? null : v), 2000)
      }
    }, 800)
  }

  const potentialSupervisors = useMemo(
    () => teamMembers.filter(m => m.is_supervisor),
    [teamMembers]
  )

  const groupedMembers = useMemo(() => {
    const owners      = teamMembers.filter(m => m.role === 'owner')
    const managers    = teamMembers.filter(m => m.role === 'manager')
    const supervisors = teamMembers.filter(m => m.role === 'salesperson' && m.is_supervisor)
    const salespeople = teamMembers.filter(m => m.role === 'salesperson' && !m.is_supervisor)
    const groupedSalespeople = {}
    salespeople.forEach(s => {
      const key = s.supervisor_id || 'unassigned'
      if (!groupedSalespeople[key]) groupedSalespeople[key] = []
      groupedSalespeople[key].push(s)
    })
    return { owners, managers, supervisors, salespeople, groupedSalespeople }
  }, [teamMembers])

  async function handleSupervisorChange(userId, newSupervisorId) {
    setTeamMembers(prev => prev.map(m =>
      m.id === userId ? { ...m, supervisor_id: newSupervisorId || null } : m
    ))
    setSavingMember(userId)
    await supabase.from('profiles')
      .update({ supervisor_id: newSupervisorId || null })
      .eq('id', userId)
    setSavingMember(null)
    setSavedMember(userId)
    setTimeout(() => setSavedMember(v => v === userId ? null : v), 2000)
  }

  async function handleIsSupervisorChange(userId, newValue) {
    if (!newValue) {
      const subordinates = teamMembers.filter(m => m.supervisor_id === userId)
      if (subordinates.length > 0) {
        const ok = window.confirm(
          `Este usuario supervisa a ${subordinates.length} persona${subordinates.length === 1 ? '' : 's'}. Si lo desmarca como supervisor, esos vendedores quedarán sin supervisor asignado. ¿Continuar?`
        )
        if (!ok) return
      }
    }
    setTeamMembers(prev => prev.map(m =>
      m.id === userId
        ? { ...m, is_supervisor: newValue, ...(!newValue && { supervisor_commission_pct: 0 }) }
        : m
    ))
    setSavingMember(userId)
    const patch = { is_supervisor: newValue }
    if (!newValue) patch.supervisor_commission_pct = 0
    await supabase.from('profiles').update(patch).eq('id', userId)
    setSavingMember(null)
    setSavedMember(userId)
    setTimeout(() => setSavedMember(v => v === userId ? null : v), 2000)
  }

  function handleSupervisorCommissionChange(userId, newPct) {
    setTeamMembers(prev => prev.map(m =>
      m.id === userId ? { ...m, supervisor_commission_pct: newPct } : m
    ))
    const key = `sup_${userId}`
    clearTimeout(commDebounceRef.current[key])
    commDebounceRef.current[key] = setTimeout(async () => {
      setSavingMember(userId)
      const { error } = await supabase.from('profiles')
        .update({ supervisor_commission_pct: parseFloat(newPct) || 0 })
        .eq('id', userId)
      setSavingMember(null)
      if (error) {
        supabase.from('profiles').select('supervisor_commission_pct').eq('id', userId).single()
          .then(({ data }) => {
            if (data) setTeamMembers(prev => prev.map(m =>
              m.id === userId ? { ...m, supervisor_commission_pct: data.supervisor_commission_pct } : m
            ))
          })
      } else {
        setSavedMember(userId)
        setTimeout(() => setSavedMember(v => v === userId ? null : v), 2000)
      }
    }, 800)
  }

  async function handleToggleVisibility(newValue) {
    setSellersSeeCommission(newValue)
    await supabase.from('organisations')
      .update({ sellers_see_own_commission: newValue })
      .eq('id', org.id)
    await refreshProfile()
  }

  // ── Acuerdos: cargar al entrar al tab ──
  useEffect(() => {
    if (activeTab !== 'commercial' || !isOwner) return
    loadAgreements()
  }, [activeTab, isOwner, org.id])

  async function loadAgreements(opts = {}) {
    setLoadingAgreements(true)
    const { data } = await supabase
      .from('facilitator_agreements')
      .select(`
        id, title, deal_code, commission_type, commission_pct,
        start_date, end_date, is_active, notes, created_at,
        contact:contacts!facilitator_agreements_contact_id_fkey(id, name, legal_name, visibility),
        site_commissions(id, site_id)
      `)
      .eq('org_id', org.id)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false })
    const list = data ?? []
    setAgreements(list)
    if (opts.refreshSelectedId) {
      const fresh = list.find(a => a.id === opts.refreshSelectedId)
      if (fresh) setSelectedAgreement(fresh)
    }
    setLoadingAgreements(false)
  }

  function handleAgreementUpdated(updatedOrSignal) {
    if (updatedOrSignal === null) {
      setSelectedAgreement(null)
      loadAgreements()
    } else if (updatedOrSignal === 'reload') {
      loadAgreements({ refreshSelectedId: selectedAgreement?.id })
    } else {
      setAgreements(prev => prev.map(a => a.id === updatedOrSignal.id ? updatedOrSignal : a))
      setSelectedAgreement(updatedOrSignal)
    }
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

  const renderTeamRow = (member) => {
    const isSaving = savingMember === member.id
    const isSaved  = savedMember  === member.id
    const isOwnerRow = member.role === 'owner'
    const supervisorOptions = potentialSupervisors.filter(s => s.id !== member.id)
    return (
      <tr key={member.id} className="hover:bg-surface-800/40 transition-colors">
        {/* Nombre */}
        <td className="px-3 py-3 font-medium text-slate-200 whitespace-nowrap">
          {member.full_name || <span className="text-slate-500">—</span>}
        </td>
        {/* % Comisión */}
        <td className="px-3 py-3">
          {isOwnerRow ? (
            <span className="text-slate-600 text-xs">—</span>
          ) : (
            <div className="relative w-20">
              <input
                type="number" min="0" max="100" step="0.5"
                value={member.commission_pct ?? 0}
                onChange={e => handleCommissionChange(member.id, e.target.value)}
                className="input-field w-full text-right pr-6"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
            </div>
          )}
        </td>
        {/* Reporta a */}
        <td className="px-3 py-3">
          {isOwnerRow ? (
            <span className="text-xs text-slate-600">—</span>
          ) : supervisorOptions.length === 0 ? (
            <span className="text-xs italic text-slate-600">Sin supervisores</span>
          ) : (
            <select
              className="input-field text-sm"
              value={member.supervisor_id ?? ''}
              onChange={e => handleSupervisorChange(member.id, e.target.value)}
            >
              <option value="">— Ninguno —</option>
              {supervisorOptions.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          )}
        </td>
        {/* Supervisa */}
        <td className="px-3 py-3">
          {member.is_supervisor ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleIsSupervisorChange(member.id, false)}
                className="rounded-full bg-brand/20 px-2 py-0.5 text-xs font-medium text-brand hover:bg-brand/30 transition-colors"
              >
                ✓ Sí
              </button>
              <div className="relative w-14">
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={member.supervisor_commission_pct ?? 0}
                  onChange={e => handleSupervisorCommissionChange(member.id, e.target.value)}
                  className="input-field w-full text-right pr-5"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleIsSupervisorChange(member.id, true)}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              —
            </button>
          )}
        </td>
        {/* Status */}
        <td className="px-3 py-3 text-right whitespace-nowrap">
          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500 inline" />}
          {isSaved  && <span className="text-xs text-brand">✓ Guardado</span>}
        </td>
      </tr>
    )
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

        {/* TAB 3 — Equipo y comisiones */}
        {activeTab === 'team' && (
          <>
            {/* Card 1 — Miembros */}
            <Card>
              <CardHeader
                title="Miembros del equipo"
                subtitle="% de comisión por venta que corresponde a cada miembro"
              />
              {loadingTeam ? (
                <div className="flex items-center justify-center py-10 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
                </div>
              ) : teamMembers.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No hay miembros en esta organización.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-700">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">% Comisión</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Reporta a</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400" title="Cobra un % override por ventas de su equipo">Supervisa</th>
                        <th className="w-20 px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-700">

                      {/* DUEÑOS */}
                      {groupedMembers.owners.length > 0 && (
                        <>
                          <tr className="bg-surface-900/60">
                            <td colSpan={5} className="px-3 py-2">
                              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Dueños</span>
                              <span className="ml-1.5 text-[11px] text-slate-600">({groupedMembers.owners.length})</span>
                            </td>
                          </tr>
                          {groupedMembers.owners.map(m => renderTeamRow(m))}
                        </>
                      )}

                      {/* GERENTES */}
                      {groupedMembers.managers.length > 0 && (
                        <>
                          <tr className="bg-surface-900/60">
                            <td colSpan={5} className="px-3 py-2">
                              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Gerentes</span>
                              <span className="ml-1.5 text-[11px] text-slate-600">({groupedMembers.managers.length})</span>
                            </td>
                          </tr>
                          {groupedMembers.managers.map(m => renderTeamRow(m))}
                        </>
                      )}

                      {/* SUPERVISORES (salesperson + is_supervisor) */}
                      {groupedMembers.supervisors.length > 0 && (
                        <>
                          <tr className="bg-surface-900/60">
                            <td colSpan={5} className="px-3 py-2">
                              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Supervisores</span>
                              <span className="ml-1.5 text-[11px] text-slate-600">({groupedMembers.supervisors.length})</span>
                            </td>
                          </tr>
                          {groupedMembers.supervisors.map(m => renderTeamRow(m))}
                        </>
                      )}

                      {/* VENDEDORES */}
                      {groupedMembers.salespeople.length > 0 && (
                        <>
                          <tr className="bg-surface-900/60">
                            <td colSpan={5} className="px-3 py-2">
                              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Vendedores</span>
                              <span className="ml-1.5 text-[11px] text-slate-600">({groupedMembers.salespeople.length})</span>
                            </td>
                          </tr>
                          {Object.entries(groupedMembers.groupedSalespeople)
                            .filter(([key]) => key !== 'unassigned')
                            .map(([supId, members]) => {
                              const supName = teamMembers.find(m => m.id === supId)?.full_name ?? 'Supervisor'
                              return (
                                <Fragment key={supId}>
                                  <tr>
                                    <td colSpan={5} className="px-3 pb-1 pt-3">
                                      <p className="border-l-2 border-surface-600 pl-2 text-xs text-slate-500">
                                        Equipo de {supName} ({members.length})
                                      </p>
                                    </td>
                                  </tr>
                                  {members.map(m => renderTeamRow(m))}
                                </Fragment>
                              )
                            })}
                          {groupedMembers.groupedSalespeople.unassigned?.length > 0 && (
                            <>
                              <tr>
                                <td colSpan={5} className="px-3 pb-1 pt-3">
                                  <p className="border-l-2 border-surface-600 pl-2 text-xs text-slate-500">
                                    Sin equipo asignado ({groupedMembers.groupedSalespeople.unassigned.length})
                                  </p>
                                </td>
                              </tr>
                              {groupedMembers.groupedSalespeople.unassigned.map(m => renderTeamRow(m))}
                            </>
                          )}
                        </>
                      )}

                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                El <strong className="text-slate-400">% comisión</strong> se aplica al monto neto de cada propuesta que el vendedor acepte. Se congela al aceptar la venta — cambios futuros no afectan ventas ya cerradas.{' '}
                <strong className="text-slate-400">Reporta a</strong>: asigna un supervisor que cobra override sobre las ventas de este miembro.{' '}
                <strong className="text-slate-400">Supervisa</strong>: declaralo si este miembro supervisa a otros y cobra un % adicional por las ventas de su equipo.
              </p>
            </Card>

            {/* Card 2 — Visibilidad */}
            <Card>
              <CardHeader
                title="Visibilidad para vendedores"
                subtitle="Controla si los vendedores ven su propia comisión en el planificador de propuestas"
              />
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-slate-200">Vendedores ven su comisión</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Si está activo, cada vendedor verá el % y monto estimado de su comisión al armar
                    una propuesta. Si está inactivo, solo los gerentes y dueños lo ven.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sellersSeeCommission}
                  onClick={() => handleToggleVisibility(!sellersSeeCommission)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    sellersSeeCommission ? 'bg-brand' : 'bg-surface-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    sellersSeeCommission ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </Card>
          </>
        )}

        {/* TAB 4 — Reglas comerciales */}
        {activeTab === 'commercial' && (
          <>
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
            <Card>
              <CardHeader
                title="Acuerdos con facilitadores"
                subtitle="Comisiones atadas a la locación o contrato del cartel. Se aplican automáticamente a toda venta del cartel."
                action={
                  <Button size="sm" onClick={() => setShowAgreementWizard(true)}>
                    + Nuevo acuerdo
                  </Button>
                }
              />

              {loadingAgreements ? (
                <div className="flex items-center justify-center py-10 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
                </div>
              ) : agreements.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm text-slate-500">Aún no hay acuerdos configurados</p>
                  <Button size="sm" variant="secondary" onClick={() => setShowAgreementWizard(true)}>
                    Crear el primero
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-700">
                        {['Nombre', 'Contacto', 'Tipo', '%', 'Vigencia', 'Carteles', ''].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-700">
                      {agreements.map(a => (
                        <tr
                          key={a.id}
                          onClick={() => setSelectedAgreement(a)}
                          className={`cursor-pointer hover:bg-surface-800/50 transition-colors ${!a.is_active ? 'opacity-60' : ''}`}
                        >
                          {/* Nombre */}
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-200">{a.title}</p>
                            <p className="text-xs text-slate-600 font-mono">{a.deal_code}</p>
                          </td>
                          {/* Contacto */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-300">{a.contact?.name ?? '—'}</span>
                              {a.contact?.visibility === 'owner_only' && (
                                <Lock className="h-3.5 w-3.5 text-amber-400" aria-label="Confidencial" />
                              )}
                            </div>
                            {a.contact?.legal_name && <p className="text-xs text-slate-500">{a.contact.legal_name}</p>}
                          </td>
                          {/* Tipo */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {a.commission_type === 'location_facilitator' ? (
                                <span className="inline-flex w-fit rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">Locación</span>
                              ) : (
                                <span className="inline-flex w-fit rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">Contrato</span>
                              )}
                              {!a.is_active && (
                                <span className="inline-flex w-fit rounded-full bg-surface-700 px-2 py-0.5 text-xs text-slate-400">Inactivo</span>
                              )}
                            </div>
                          </td>
                          {/* % */}
                          <td className="px-4 py-3 font-mono text-slate-300">
                            {Number(a.commission_pct).toFixed(2)}%
                          </td>
                          {/* Vigencia */}
                          <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                            {a.end_date
                              ? <>{fmtDate(a.start_date)} → {fmtDate(a.end_date)}</>
                              : <>Desde {fmtDate(a.start_date)}</>
                            }
                          </td>
                          {/* Carteles */}
                          <td className="px-4 py-3">
                            {(a.site_commissions?.length ?? 0) === 0 ? (
                              <span className="text-xs italic text-slate-500">— marco —</span>
                            ) : (
                              <span className="text-sm text-slate-300">
                                {a.site_commissions.length} cartel{a.site_commissions.length === 1 ? '' : 'es'}
                              </span>
                            )}
                          </td>
                          {/* Ver detalle */}
                          <td className="px-4 py-3">
                            <ChevronRight className="h-4 w-4 text-slate-600" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {/* Wizard nuevo acuerdo */}
        {showAgreementWizard && (
          <NewFacilitatorAgreementWizard
            onClose={() => setShowAgreementWizard(false)}
            onSaved={() => { setShowAgreementWizard(false); loadAgreements() }}
          />
        )}

        {/* Panel de detalle de acuerdo */}
        {selectedAgreement && (
          <AgreementDetailPanel
            agreement={selectedAgreement}
            onClose={() => setSelectedAgreement(null)}
            onUpdated={handleAgreementUpdated}
          />
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
