import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import WizardStep1Form    from '../../features/proposals/WizardStep1Form'
import WizardStep2Loading from '../../features/proposals/WizardStep2Loading'
import WizardStep3Results from '../../features/proposals/WizardStep3Results'
import { MOCK_RESPONSE, mockDelay } from '../../lib/mockPlanData'
import Spinner from '../../components/ui/Spinner'

// VITE_USE_MOCK_AI=true habilita el mock (sin Edge Function).
// Por defecto (producción): usar la Edge Function real.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_AI === 'true'

const EMPTY_FORM = {
  clientName: '',
  clientEmail: '',
  objective: '',
  formats: [],
  digitalFrequency: 'indistinto',
  spotDurationSec: 10,
  dailySpots: 540,
  operatingHours: '07:00-02:00',
  provinces: ['CABA'],
  cities: ['Buenos Aires (CABA)'],
  corridorId: null,
  corridorName: null,
  fixedBillboards: [],  // [{ id, name, address }]
  budget: '',
  discountPct: 0,
  startDate: '',
  endDate: '',
  audience: { ageMin: 18, ageMax: 55, gender: 'all', interests: [], nse: [] },
  adImageFile: null,
}

export default function ProposalNew() {
  const { profile, role, org } = useAuth()
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const isEditing = !!editId

  const [step, setStep]                 = useState(1)
  const [formData, setFormData]         = useState(EMPTY_FORM)
  const [results, setResults]           = useState(null)
  const [error, setError]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [loadingEdit, setLoadingEdit]   = useState(isEditing)
  const [existingProposal, setExistingProposal] = useState(null)
  // ID del draft auto-guardado al recibir el resultado del LLM. Se usa en handleSave
  // para hacer UPDATE en lugar de INSERT y así no crear propuestas duplicadas.
  const [draftProposalId, setDraftProposalId] = useState(null)

  // ── Load existing proposal for editing ─────────────────────
  useEffect(() => {
    if (!isEditing) return
    supabase
      .from('proposals')
      .select('*')
      .eq('id', editId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setError('No se encontró la propuesta')
          setLoadingEdit(false)
          return
        }
        setExistingProposal(data)
        setDraftProposalId(data.id)  // para que el resave haga UPDATE
        const b = data.brief_data ?? {}
        setFormData({
          clientName:       data.client_name ?? '',
          clientEmail:      data.client_email ?? '',
          objective:        b.objective ?? '',
          formats:          b.formats ?? [],
          digitalFrequency: b.digitalFrequency ?? 'indistinto',
          spotDurationSec:  b.spotDurationSec ?? 10,
          dailySpots:       b.dailySpots ?? 540,
          operatingHours:   b.operatingHours ?? '07:00-02:00',
          provinces:        b.provinces ?? ['CABA'],
          cities:           b.cities ?? [b.city ?? 'Buenos Aires (CABA)'],
          corridorId:       b.corridorId ?? null,
          corridorName:     b.corridorName ?? null,
          fixedBillboards:  b.fixedBillboards ?? [],
          budget:           b.budget ?? '',
          discountPct:      data.discount_pct ?? 0,
          startDate:        b.startDate ?? '',
          endDate:          b.endDate ?? (data.valid_until ?? ''),
          audience:         b.audience ?? { ageMin: 18, ageMax: 55, gender: 'all', interests: [], nse: [] },
          adImageFile:      null,
        })
        setLoadingEdit(false)
      })
  }, [editId, isEditing])

  // ── Step 1 → 2 → 3 ─────────────────────────────────────────
  async function handleFormSubmit() {
    setError('')
    setStep(2)

    try {
      let data

      if (USE_MOCK) {
        await mockDelay()
        data = MOCK_RESPONSE
      } else {
        // Obtener token de sesión actual
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('No hay sesión activa. Volvé a iniciar sesión.')

        const { data: fnData, error: fnError } = await supabase.functions.invoke('plan-pauta', {
          body: {
            formData: {
              clientName:       formData.clientName,
              clientEmail:      formData.clientEmail,
              objective:        formData.objective,
              formats:          formData.formats,
              digitalFrequency: formData.digitalFrequency,
              spotDurationSec:  formData.spotDurationSec ?? 10,
              dailySpots:       formData.dailySpots ?? 540,
              operatingHours:   formData.operatingHours ?? '07:00-02:00',
              provinces:        formData.provinces,
              cities:           formData.cities,
              corridorId:       formData.corridorId ?? null,
              corridorName:     formData.corridorName ?? null,
              fixedBillboards:  formData.fixedBillboards ?? [],
              budget:           formData.budget,
              discountPct:      formData.discountPct ?? 0,
              startDate:        formData.startDate,
              endDate:          formData.endDate,
              audience:         formData.audience,
            },
            orgId: profile.org_id,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (fnError) throw new Error(fnError.message || 'Error al llamar a la Edge Function. ¿Está desplegada?')

        if (fnData?.error) throw new Error(fnData.error)
        data = fnData
      }

      if (!data?.optionA && !data?.optionB) {
        throw new Error('La IA no devolvió propuestas válidas. Intentá de nuevo.')
      }

      // ── AUTO-SAVE del borrador con ambas opciones embebidas ──
      // Evita perder la propuesta si el vendedor descarga el PDF pero olvida "guardar".
      // En modo edit NO se crea nuevo: se reusa el draftProposalId existente.
      if (!isEditing && !draftProposalId && profile?.org_id) {
        const autoSaveBrief = {
          objective:        formData.objective,
          formats:          formData.formats,
          digitalFrequency: formData.digitalFrequency,
          spotDurationSec:  formData.spotDurationSec ?? 10,
          dailySpots:       formData.dailySpots ?? 540,
          operatingHours:   formData.operatingHours ?? '07:00-02:00',
          provinces:        formData.provinces,
          cities:           formData.cities,
          corridorId:       formData.corridorId,
          corridorName:     formData.corridorName,
          fixedBillboards:  formData.fixedBillboards,
          budget:           formData.budget,
          discountPct:      formData.discountPct ?? 0,
          startDate:        formData.startDate,
          endDate:          formData.endDate,
          audience:         formData.audience,
          selectedOption:   null,   // todavía no eligió A ni B
        }
        const locationLabel = (formData.cities ?? []).join(', ') || 'Argentina'
        const draftTitle = `Pauta ${formData.clientName || 'sin cliente'} — ${locationLabel} [borrador]`

        const { data: draft, error: draftErr } = await supabase
          .from('proposals')
          .insert({
            org_id:        profile.org_id,
            title:         draftTitle,
            client_name:   formData.clientName,
            client_email:  formData.clientEmail || null,
            status:        'draft',
            total_value:   0,  // se actualiza cuando elige una opción
            discount_pct:  formData.discountPct ?? 0,
            valid_until:   formData.endDate || null,
            created_by:    profile.id,
            brief_data:    autoSaveBrief,
            option_a_data: data.optionA ?? null,
            option_b_data: data.optionB ?? null,
          })
          .select()
          .single()

        if (draftErr) {
          // Si falla el auto-save (ej: columnas option_*_data no existen todavía),
          // no rompemos el flujo — solo logueamos y el usuario seguirá con el comportamiento viejo.
          console.warn('Auto-save draft falló:', draftErr.message)
        } else if (draft?.id) {
          setDraftProposalId(draft.id)
        }
      }

      setResults(data)
      setStep(3)

    } catch (err) {
      setError(err.message ?? 'Error desconocido')
      setStep(1)
    }
  }

  // ── Save (create or update) ─────────────────────────────────
  async function handleSave(option, optionLabel, partialSelections = {}) {
    if (!option || !profile?.org_id) return
    setSaving(true)

    const discountPct  = formData.discountPct ?? 0
    const maxDiscount  = role === 'owner' ? 100
      : role === 'manager' ? (org?.max_discount_manager ?? 30)
      : (org?.max_discount_salesperson ?? 20)
    const needsApproval = discountPct > maxDiscount

    const listTotal  = option.total_list_price ?? 0
    const totalValue = option.total_client_price ?? Math.round(listTotal * (1 - discountPct / 100))
    const locationLabel = (formData.cities ?? []).join(', ') || 'Argentina'
    const title      = `Pauta ${formData.clientName} — ${locationLabel} (${optionLabel})`
    const briefData  = {
      objective:        formData.objective,
      formats:          formData.formats,
      digitalFrequency: formData.digitalFrequency,
      spotDurationSec:  formData.spotDurationSec ?? 10,
      dailySpots:       formData.dailySpots ?? 540,
      operatingHours:   formData.operatingHours ?? '07:00-02:00',
      provinces:        formData.provinces,
      cities:           formData.cities,
      corridorId:       formData.corridorId,
      corridorName:     formData.corridorName,
      fixedBillboards:  formData.fixedBillboards,
      budget:           formData.budget,
      discountPct,
      startDate:        formData.startDate,
      endDate:          formData.endDate,
      audience:         formData.audience,
      selectedOption:   optionLabel,
    }

    function isMissingColumnError(err) {
      const msg = err?.message ?? ''
      return msg.includes('discount_pct') ||
             msg.includes('pending_approval') ||
             msg.includes('schema cache')
    }

    try {
      // CASO 1: Estamos actualizando una propuesta existente (draft auto-guardado O edit de una
      // propuesta ya confirmada). Siempre hacemos UPDATE + reemplazo de items.
      if (draftProposalId) {
        const baseProposal = existingProposal ?? { status: 'draft', client_name: null, client_email: null, total_value: null, valid_until: null }

        const updates = {
          title,
          client_name:  formData.clientName,
          client_email: formData.clientEmail || null,
          total_value:  totalValue,
          discount_pct: discountPct,
          // Si ya estaba aceptada u otro estado terminal, no lo tocamos.
          // Si estaba 'pending_approval' y ya no necesita approval, vuelve a draft.
          // Si era 'draft' (autosave), pasa a draft/pending_approval según discount.
          status:
            needsApproval ? 'pending_approval'
            : baseProposal.status === 'pending_approval' ? 'draft'
            : baseProposal.status === 'draft' ? 'draft'
            : baseProposal.status,
          valid_until:  formData.endDate || null,
          brief_data:   briefData,
        }

        let { error: upErr } = await supabase
          .from('proposals')
          .update(updates)
          .eq('id', draftProposalId)

        if (upErr && isMissingColumnError(upErr)) {
          const { title: t, client_name, client_email, total_value, valid_until, brief_data } = updates
          const { error: upErr2 } = await supabase
            .from('proposals')
            .update({ title: t, client_name, client_email, total_value, valid_until, brief_data, status: 'draft' })
            .eq('id', draftProposalId)
          upErr = upErr2
        }

        if (upErr) throw upErr

        // Historial (solo si existe baseProposal con data previa, i.e. edit de algo ya guardado)
        if (existingProposal) {
          const trackFields = {
            client_name:  [existingProposal.client_name,               formData.clientName],
            client_email: [existingProposal.client_email ?? '',        formData.clientEmail],
            total_value:  [String(existingProposal.total_value ?? ''), String(totalValue)],
            valid_until:  [existingProposal.valid_until ?? '',         formData.endDate],
          }
          const historyRows = Object.entries(trackFields)
            .filter(([, [oldVal, newVal]]) => String(oldVal) !== String(newVal))
            .map(([field, [oldVal, newVal]]) => ({
              proposal_id:   draftProposalId,
              edited_by:     profile.id,
              field_changed: field,
              old_value:     String(oldVal ?? ''),
              new_value:     String(newVal ?? ''),
            }))

          if (historyRows.length > 0) {
            await supabase.from('proposal_history').insert(historyRows)
          }
        }

        // REEMPLAZAR items: borrar los existentes y recrear con la opción elegida.
        // Esto permite que el usuario cambie de opción A → B sin crear propuesta duplicada.
        const { error: delErr } = await supabase
          .from('proposal_items')
          .delete()
          .eq('proposal_id', draftProposalId)
        if (delErr) console.warn('proposal_items delete error:', delErr.message)

        const items = (option.sites ?? [])
          .filter(s => s.id && !s.id.startsWith('mock-'))
          .map(s => {
            const partial = partialSelections[s.id]
            return {
              proposal_id: draftProposalId,
              site_id:     s.id,
              org_id:      profile.org_id,
              rate:        partial ? partial.listPrice : (s.list_price ?? null),
              notes:       s.justification ?? null,
              start_date:  partial ? partial.startDate : (formData.startDate || null),
              end_date:    formData.endDate || null,
              discount_pct: formData.discountPct ?? 0,
            }
          })

        if (items.length > 0) {
          const { error: itemErr } = await supabase.from('proposal_items').insert(items)
          if (itemErr) console.warn('proposal_items insert error:', itemErr.message)
        }

      // CASO 2: Fallback — no hay draftProposalId (auto-save falló o columnas option_*_data no existen).
      // Se crea la propuesta de cero con el flujo viejo.
      } else {
        const fullInsert = {
          org_id:       profile.org_id,
          title,
          client_name:  formData.clientName,
          client_email: formData.clientEmail || null,
          status:       needsApproval ? 'pending_approval' : 'draft',
          total_value:  totalValue,
          discount_pct: discountPct,
          valid_until:  formData.endDate || null,
          created_by:   profile.id,
          brief_data:   briefData,
        }

        let { data: proposal, error: propErr } = await supabase
          .from('proposals')
          .insert(fullInsert)
          .select()
          .single()

        if (propErr && isMissingColumnError(propErr)) {
          const { org_id, title: t, client_name, client_email, total_value, valid_until, created_by, brief_data } = fullInsert
          const res2 = await supabase
            .from('proposals')
            .insert({ org_id, title: t, client_name, client_email, status: 'draft', total_value, valid_until, created_by, brief_data })
            .select()
            .single()
          proposal = res2.data
          propErr  = res2.error
        }

        if (propErr) throw propErr

        // Recordar el id para futuros re-saves en la misma sesión
        if (proposal?.id) setDraftProposalId(proposal.id)

        const items = (option.sites ?? [])
          .filter(s => s.id && !s.id.startsWith('mock-'))
          .map(s => {
            const partial = partialSelections[s.id]
            return {
              proposal_id: proposal.id,
              site_id:     s.id,
              org_id:      profile.org_id,
              rate:        partial ? partial.listPrice : (s.list_price ?? null),
              notes:       s.justification ?? null,
              start_date:  partial ? partial.startDate : (formData.startDate || null),
              end_date:    formData.endDate || null,
              discount_pct: formData.discountPct ?? 0,
            }
          })

        if (items.length > 0) {
          const { error: itemErr } = await supabase.from('proposal_items').insert(items)
          if (itemErr) console.warn('proposal_items insert error:', itemErr.message)
        }
      }

      // No navegar — WizardStep3Results maneja el estado saved

    } catch (err) {
      setError(`Error al guardar: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const steps = [
    { n: 1, label: 'Brief' },
    { n: 2, label: 'Procesando' },
    { n: 3, label: 'Resultado' },
  ]

  if (loadingEdit) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => step === 3 ? setStep(1) : navigate('/app/proposals')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-200 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {step === 3 ? 'Editar brief' : 'Propuestas'}
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`h-px w-8 transition-colors ${step > i ? 'bg-brand' : 'bg-surface-700'}`} />
              )}
              <div className="flex items-center gap-1.5">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  step === s.n ? 'bg-brand text-white' :
                  step > s.n  ? 'bg-brand/30 text-brand' :
                  'bg-surface-700 text-slate-500'
                }`}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className={`hidden sm:block text-xs ${step === s.n ? 'text-white font-medium' : 'text-slate-500'}`}>
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {isEditing && (
          <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
            Editando
          </span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">Error al planificar</p>
            <p className="text-xs text-red-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Steps */}
      {step === 1 && (
        <WizardStep1Form
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleFormSubmit}
        />
      )}

      {step === 2 && <WizardStep2Loading />}

      {step === 3 && results && (
        <WizardStep3Results
          results={results}
          formData={formData}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  )
}