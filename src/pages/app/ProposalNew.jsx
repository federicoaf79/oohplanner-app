import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import WizardStep1Form    from '../../features/proposals/WizardStep1Form'
import WizardStep2Loading from '../../features/proposals/WizardStep2Loading'
import WizardStep3Results from '../../features/proposals/WizardStep3Results'
import { MOCK_RESPONSE, mockDelay } from '../../lib/mockPlanData'

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
  startDate: '',
  endDate: '',
  audience: { ageMin: 18, ageMax: 55, gender: 'all', interests: [], nse: [] },
  adImageFile: null,
}

export default function ProposalNew() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]         = useState(1)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [results, setResults]   = useState(null)
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)

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

  // ── Save proposal to DB ─────────────────────────────────────
  async function handleSave(option, optionLabel) {
    if (!option || !profile?.org_id) return
    setSaving(true)

    try {
      const totalValue = option.metrics?.totalRate ?? 0

      // Insert proposal
      const { data: proposal, error: propErr } = await supabase
        .from('proposals')
        .insert({
          org_id:      profile.org_id,
          title:       `Pauta ${formData.clientName} — ${formData.city} (${optionLabel})`,
          client_name: formData.clientName,
          client_email:formData.clientEmail || null,
          status:      'draft',
          total_value: totalValue,
          valid_until: formData.endDate || null,
          created_by:  profile.id,
        })
        .select()
        .single()

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

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => step === 3 ? setStep(1) : navigate('/app/proposals')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-200 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {step === 3 ? 'Editar brief' : 'Propuestas'}
        </button>

        {/* Step dots */}
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
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">Error al planificar</p>
            <p className="text-xs text-red-400 mt-0.5">{error}</p>
            {!USE_MOCK && error.includes('function') && (
              <p className="text-xs text-red-500/70 mt-1">
                La Edge Function no está desplegada. Activá el modo mock con{' '}
                <code className="font-mono">VITE_USE_MOCK_AI=true</code> en .env.local
              </p>
            )}
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
