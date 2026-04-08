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

// Default to mock=true so deploys without the env var don't hang waiting
// for an Edge Function that may not be deployed yet.
// Set VITE_USE_MOCK_AI=false in Vercel env vars to enable the real AI.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_AI !== 'false'

const EMPTY_FORM = {
  clientName: '',
  clientEmail: '',
  objective: '',
  formats: [],
  digitalFrequency: 'indistinto',
  city: 'Buenos Aires (CABA)',
  radiusKm: 10,
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
        const b = data.brief_data ?? {}
        setFormData({
          clientName:       data.client_name ?? '',
          clientEmail:      data.client_email ?? '',
          objective:        b.objective ?? '',
          formats:          b.formats ?? [],
          digitalFrequency: b.digitalFrequency ?? 'indistinto',
          city:             b.city ?? 'Buenos Aires (CABA)',
          radiusKm:         b.radiusKm ?? 10,
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
        const { data: fnData, error: fnError } = await supabase.functions.invoke('plan-pauta', {
          body: {
            formData: {
              clientName:       formData.clientName,
              clientEmail:      formData.clientEmail,
              objective:        formData.objective,
              formats:          formData.formats,
              digitalFrequency: formData.digitalFrequency,
              city:             formData.city,
              radiusKm:         formData.radiusKm,
              budget:           formData.budget,
              startDate:        formData.startDate,
              endDate:          formData.endDate,
              audience:         formData.audience,
            },
            orgId: profile.org_id,
          },
        })

        if (fnError) throw new Error(fnError.message)
        if (fnData?.error) throw new Error(fnData.error)
        data = fnData
      }

      if (!data?.optionA && !data?.optionB) {
        throw new Error('La IA no devolvió propuestas válidas. Intentá de nuevo.')
      }

      setResults(data)
      setStep(3)

    } catch (err) {
      setError(err.message ?? 'Error desconocido')
      setStep(1)
    }
  }

  // ── Save (create or update) ─────────────────────────────────
  async function handleSave(option, optionLabel) {
    if (!option || !profile?.org_id) return
    setSaving(true)

    const discountPct  = formData.discountPct ?? 0
    const maxDiscount  = role === 'owner' ? 100
      : role === 'manager' ? (org?.max_discount_manager ?? 30)
      : (org?.max_discount_salesperson ?? 20)
    const needsApproval = discountPct > maxDiscount

    const listTotal  = option.metrics?.totalRate ?? 0
    const totalValue = Math.round(listTotal * (1 - discountPct / 100))
    const title      = `Pauta ${formData.clientName} — ${formData.city} (${optionLabel})`
    const briefData  = {
      objective:        formData.objective,
      formats:          formData.formats,
      digitalFrequency: formData.digitalFrequency,
      city:             formData.city,
      radiusKm:         formData.radiusKm,
      budget:           formData.budget,
      discountPct,
      startDate:        formData.startDate,
      endDate:          formData.endDate,
      audience:         formData.audience,
      selectedOption:   optionLabel,
    }

    // Detecta si un error de Supabase es por columnas de migration_v3
    // que aún no fueron ejecutadas en el SQL Editor.
    function isMissingColumnError(err) {
      const msg = err?.message ?? ''
      return msg.includes('discount_pct') ||
             msg.includes('pending_approval') ||
             msg.includes('schema cache')
    }

    try {
      if (isEditing && existingProposal) {
        // ── Update existing proposal ──
        const updates = {
          title,
          client_name:  formData.clientName,
          client_email: formData.clientEmail || null,
          total_value:  totalValue,
          discount_pct: discountPct,
          status:       needsApproval ? 'pending_approval' : (existingProposal.status === 'pending_approval' ? 'draft' : existingProposal.status),
          valid_until:  formData.endDate || null,
          brief_data:   briefData,
        }

        let { error: upErr } = await supabase
          .from('proposals')
          .update(updates)
          .eq('id', existingProposal.id)

        // Fallback: si migration_v3 no fue ejecutada, reintentar sin columnas nuevas
        if (upErr && isMissingColumnError(upErr)) {
          const { title: t, client_name, client_email, total_value, valid_until, brief_data } = updates
          const { error: upErr2 } = await supabase
            .from('proposals')
            .update({ title: t, client_name, client_email, total_value, valid_until, brief_data, status: 'draft' })
            .eq('id', existingProposal.id)
          upErr = upErr2
        }

        if (upErr) throw upErr

        // Write history for changed fields
        const trackFields = {
          client_name:  [existingProposal.client_name,               formData.clientName],
          client_email: [existingProposal.client_email ?? '',        formData.clientEmail],
          total_value:  [String(existingProposal.total_value ?? ''), String(totalValue)],
          valid_until:  [existingProposal.valid_until ?? '',         formData.endDate],
        }
        const historyRows = Object.entries(trackFields)
          .filter(([, [oldVal, newVal]]) => String(oldVal) !== String(newVal))
          .map(([field, [oldVal, newVal]]) => ({
            proposal_id:   existingProposal.id,
            edited_by:     profile.id,
            field_changed: field,
            old_value:     String(oldVal ?? ''),
            new_value:     String(newVal ?? ''),
          }))

        if (historyRows.length > 0) {
          await supabase.from('proposal_history').insert(historyRows)
        }

      } else {
        // ── Insert new proposal ──
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

        // Fallback: si migration_v3 no fue ejecutada, reintentar sin columnas nuevas
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

        // Insert proposal_items
        const items = (option.sites ?? [])
          .filter(s => s.site_id && !s.site_id.startsWith('mock-'))
          .map(s => ({
            proposal_id: proposal.id,
            site_id:     s.site_id,
            org_id:      profile.org_id,
            rate:        s.rate ?? null,
            notes:       s.justification ?? null,
          }))

        if (items.length > 0) {
          const { error: itemErr } = await supabase.from('proposal_items').insert(items)
          if (itemErr) console.warn('proposal_items insert error:', itemErr.message)
        }
      }

      navigate('/app/proposals')

    } catch (err) {
      setError(`Error al guardar: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Progress indicator ──────────────────────────────────────
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
