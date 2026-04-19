import { useState, useEffect } from 'react'
import { X, Loader2, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import EditAgreementModal from './EditAgreementModal'
import AddSitesToAgreementModal from './AddSitesToAgreementModal'

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function AgreementDetailPanel({ agreement: initialAgreement, onClose, onUpdated }) {
  const [agreement, setAgreement]   = useState(initialAgreement)
  const [sites, setSites]           = useState([])
  const [loadingSites, setLoadingSites] = useState(true)
  const [showEditModal, setShowEditModal]   = useState(false)
  const [showAddSites, setShowAddSites]     = useState(false)
  const [confirmUnlink, setConfirmUnlink]   = useState(null) // site_commission row
  const [confirmDelete, setConfirmDelete]   = useState(false)
  const [toggling, setToggling]     = useState(false)

  async function loadSites() {
    setLoadingSites(true)
    const { data } = await supabase
      .from('site_commissions')
      .select(`
        id, site_id, notes_site_specific,
        site:inventory!site_commissions_site_id_fkey(id, name, code, address, is_complete)
      `)
      .eq('agreement_id', agreement.id)
      .order('created_at')
    setSites(data ?? [])
    setLoadingSites(false)
  }

  useEffect(() => { loadSites() }, [agreement.id])

  async function handleToggleActive() {
    setToggling(true)
    const newVal = !agreement.is_active
    await supabase.from('facilitator_agreements').update({ is_active: newVal }).eq('id', agreement.id)
    const updated = { ...agreement, is_active: newVal }
    setAgreement(updated)
    onUpdated(updated)
    setToggling(false)
  }

  async function handleDelete() {
    await supabase.from('facilitator_agreements').delete().eq('id', agreement.id)
    onUpdated(null) // signal deletion
    onClose()
  }

  async function handleUnlinkSite(row) {
    await supabase.from('site_commissions').delete().eq('id', row.id)
    setSites(prev => prev.filter(s => s.id !== row.id))
    setConfirmUnlink(null)
  }

  const contact = agreement.contact
  const isOwnerOnly = contact?.visibility === 'owner_only'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full md:max-w-3xl flex-col rounded-2xl border border-slate-700 bg-surface-800 shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-surface-700 px-6 py-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-white truncate">
                {agreement.title}
              </h2>
              {!agreement.is_active && (
                <span className="rounded-full bg-surface-700 px-2 py-0.5 text-xs text-slate-400">Inactivo</span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-400">
              {isOwnerOnly ? '🔒 ' : ''}{contact?.name ?? '—'}
              {contact?.legal_name && <span className="ml-1.5 text-xs text-slate-500">{contact.legal_name}</span>}
            </p>
            <p className="mt-0.5 font-mono text-xs text-slate-600">{agreement.deal_code}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Condiciones del acuerdo */}
          <div className="px-6 py-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-surface-900/60 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Tipo</p>
                {agreement.commission_type === 'location_facilitator'
                  ? <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">Facilitador de locación</span>
                  : <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">Contrato de comercialización</span>
                }
              </div>
              <div className="rounded-lg bg-surface-900/60 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Comisión</p>
                <p className="font-mono font-semibold text-white">{Number(agreement.commission_pct).toFixed(2)}%</p>
              </div>
              <div className="rounded-lg bg-surface-900/60 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Vigencia</p>
                <p className="text-sm text-slate-200">
                  {agreement.end_date
                    ? <>{fmtDate(agreement.start_date)} → {fmtDate(agreement.end_date)}</>
                    : <>Desde {fmtDate(agreement.start_date)} (indefinido)</>
                  }
                </p>
              </div>
              {agreement.notes && (
                <div className="rounded-lg bg-surface-900/60 px-4 py-3 sm:col-span-2">
                  <p className="text-xs text-slate-500 mb-1">Notas</p>
                  <p className="text-sm text-slate-300 whitespace-pre-line">{agreement.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-surface-700" />

          {/* Carteles asociados */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-200">
                Carteles asociados
                {sites.length > 0 && <span className="ml-1.5 text-xs text-slate-500">({sites.length})</span>}
              </p>
              <button
                onClick={() => setShowAddSites(true)}
                className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar carteles
              </button>
            </div>

            {loadingSites ? (
              <div className="flex items-center justify-center py-8 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
              </div>
            ) : sites.length === 0 ? (
              <div className="rounded-lg border border-dashed border-surface-700 px-4 py-8 text-center">
                <p className="text-sm text-slate-500">Este acuerdo no tiene carteles asociados aún.</p>
                <p className="text-xs text-slate-600 mt-1">Agregá los primeros cuando sepas los detalles.</p>
                <button
                  onClick={() => setShowAddSites(true)}
                  className="mt-3 rounded-lg border border-surface-600 px-3 py-1.5 text-xs text-slate-400 hover:bg-surface-700 transition-colors"
                >
                  + Agregar carteles
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sites.map(row => (
                  <div
                    key={row.id}
                    className="flex items-center gap-3 rounded-lg border border-surface-700 px-3 py-2.5 hover:bg-surface-800/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{row.site?.name ?? row.site_id}</p>
                      {row.site?.address && <p className="text-xs text-slate-500 truncate">{row.site.address}</p>}
                    </div>
                    {row.site && !row.site.is_complete
                      ? <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">Placeholder</span>
                      : <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">Completo</span>
                    }
                    <button
                      onClick={() => setConfirmUnlink(row)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-surface-700 hover:text-red-400 transition-colors"
                    >
                      Desvincular
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer acciones */}
        <div className="shrink-0 flex flex-wrap gap-2 border-t border-surface-700 px-6 py-4">
          <button onClick={() => setShowEditModal(true)} className="btn-secondary text-sm">
            Editar condiciones
          </button>
          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {toggling ? '…' : agreement.is_active ? 'Desactivar acuerdo' : 'Activar acuerdo'}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Eliminar acuerdo
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <EditAgreementModal
          agreement={agreement}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false)
            // Reload fresh data from parent (via onUpdated with null triggers reload)
            onUpdated('reload')
          }}
        />
      )}

      {/* Add sites modal */}
      {showAddSites && (
        <AddSitesToAgreementModal
          agreement={agreement}
          onClose={() => setShowAddSites(false)}
          onSaved={() => { setShowAddSites(false); loadSites() }}
        />
      )}

      {/* Unlink confirm */}
      {confirmUnlink && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-surface-800 p-6 shadow-2xl">
            <h3 className="mb-2 font-semibold text-white">Desvincular cartel</h3>
            <p className="mb-6 text-sm text-slate-400">
              ¿Desvincular <strong className="text-slate-200">{confirmUnlink.site?.name ?? 'este cartel'}</strong> del acuerdo?
              El cartel seguirá en el inventario.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmUnlink(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => handleUnlinkSite(confirmUnlink)} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">
                Desvincular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-surface-800 p-6 shadow-2xl">
            <h3 className="mb-2 font-semibold text-white">Eliminar acuerdo</h3>
            <p className="mb-6 text-sm text-slate-400">
              ¿Eliminar el acuerdo con <strong className="text-slate-200">{contact?.name ?? '—'}</strong>?
              Los carteles quedan en el inventario sin vínculo. No se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
