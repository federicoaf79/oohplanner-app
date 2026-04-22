import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { BookUser, BarChart2, ShieldCheck, Loader2, Lock, ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import NewFacilitatorAgreementWizard from '../../features/commissions/NewFacilitatorAgreementWizard'
import AgreementDetailPanel from '../../features/commissions/AgreementDetailPanel'

function SaveRow({ loading, saved, children }) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" loading={loading}>{children ?? 'Guardar cambios'}</Button>
      {saved && <span className="text-sm text-teal-400">✓ Guardado</span>}
    </div>
  )
}

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// Placeholder metadata for tabs not yet migrated. 'team' and 'commercial' are
// implemented below; 'contacts' and 'reports' still live as dead code in
// Settings.jsx pending future migration.
const PLACEHOLDERS = {
  contacts: {
    icon: BookUser,
    title: 'Contactos Confidenciales',
    description: 'Contactos sensibles y facilitadores ocultos',
  },
  reports: {
    icon: BarChart2,
    title: 'Reportes Confidenciales',
    description: 'Acceso a reportes de rentabilidad',
  },
}

const TABS = [
  { id: 'team',       label: 'Equipo y comisiones' },
  { id: 'commercial', label: 'Reglas Comerciales' },
  { id: 'contacts',   label: 'Contactos Confidenciales' },
  { id: 'reports',    label: 'Reportes Confidenciales' },
]

export default function InventorySettings() {
  const { profile, org, isOwner, refreshProfile } = useAuth()

  // Local-only — not persisted. See file-level comment in prior version.
  const [allowManagerAccess, setAllowManagerAccess] = useState(false)
  const [activeTab, setActiveTab] = useState('team')

  // ── Equipo y comisiones: state ──
  const [teamMembers,          setTeamMembers]          = useState([])
  const [loadingTeam,          setLoadingTeam]          = useState(false)
  const [sellersSeeCommission, setSellersSeeCommission] = useState(org?.sellers_see_own_commission ?? false)
  const [savingMember,         setSavingMember]         = useState(null) // userId guardando
  const [savedMember,          setSavedMember]          = useState(null) // userId con checkmark
  const commDebounceRef                                 = useRef({})     // { [userId]: timeoutId }

  // ── Reglas comerciales: descuentos ──
  const [maxSales,   setMaxSales]   = useState(org?.max_discount_salesperson ?? 20)
  const [maxMgr,     setMaxMgr]     = useState(org?.max_discount_manager ?? 30)
  const [savingDisc, setSavingDisc] = useState(false)
  const [savedDisc,  setSavedDisc]  = useState(false)

  // ── Reglas comerciales: acuerdos con facilitadores ──
  const [agreements,          setAgreements]          = useState([])
  const [loadingAgreements,   setLoadingAgreements]   = useState(false)
  const [showAgreementWizard, setShowAgreementWizard] = useState(false)
  const [selectedAgreement,   setSelectedAgreement]   = useState(null)

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
  }, [activeTab, isOwner, org?.id])

  function handleCommissionChange(userId, newPct) {
    setTeamMembers(ms => ms.map(m => m.id === userId ? { ...m, commission_pct: newPct } : m))
    clearTimeout(commDebounceRef.current[userId])
    commDebounceRef.current[userId] = setTimeout(async () => {
      setSavingMember(userId)
      const { error } = await supabase.from('profiles')
        .update({ commission_pct: Number(newPct) })
        .eq('id', userId)
      setSavingMember(null)
      if (error) {
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

  // ── Reglas comerciales: handlers + effects ──

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

  useEffect(() => {
    if (activeTab !== 'commercial' || !isOwner) return
    loadAgreements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isOwner, org?.id])

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

  const renderTeamRow = (member) => {
    const isSaving   = savingMember === member.id
    const isSaved    = savedMember  === member.id
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

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-white">Ajustes de inventario</h2>
        <p className="text-sm text-slate-500">
          Configuración comercial y de equipo para tu operación de vía pública.
        </p>
      </div>

      {/* Owner-only access toggle */}
      {isOwner && (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="shrink-0 mt-0.5">
                <ShieldCheck className="h-5 w-5 text-brand" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Permitir acceso a Gerentes</p>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                  Cuando está activado, los usuarios con rol Manager pueden ver y editar estas secciones.
                  Por defecto está apagado — solo el Owner accede.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allowManagerAccess}
              onClick={() => setAllowManagerAccess(v => !v)}
              className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                allowManagerAccess ? 'bg-brand' : 'bg-surface-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  allowManagerAccess ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </Card>
      )}

      {/* Pill tabs */}
      <div className="flex flex-wrap gap-2 border-b border-surface-700 pb-3 overflow-x-auto">
        {TABS.map(tab => (
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

      {/* Tab content */}
      <div className="space-y-6">

        {/* TAB — Equipo y comisiones (implemented) */}
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

        {/* TAB — Reglas Comerciales (implemented) */}
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

        {/* Placeholder tabs (contacts + reports) */}
        {activeTab !== 'team' && activeTab !== 'commercial' && <PlaceholderTab kind={activeTab} />}
      </div>

      {/* Modals — rendered outside the tab content so they persist across tab switches */}
      {showAgreementWizard && (
        <NewFacilitatorAgreementWizard
          onClose={() => setShowAgreementWizard(false)}
          onSaved={() => { setShowAgreementWizard(false); loadAgreements() }}
        />
      )}

      {selectedAgreement && (
        <AgreementDetailPanel
          agreement={selectedAgreement}
          onClose={() => setSelectedAgreement(null)}
          onUpdated={handleAgreementUpdated}
        />
      )}
    </div>
  )
}

function PlaceholderTab({ kind }) {
  const meta = PLACEHOLDERS[kind]
  if (!meta) return null
  const { icon: Icon, title, description } = meta
  return (
    <Card>
      <div className="flex flex-col items-center text-center py-10 px-4">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-slate-500 max-w-md">{description}</p>
        <span className="mt-4 rounded-full bg-surface-700/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Próximamente
        </span>
      </div>
    </Card>
  )
}
