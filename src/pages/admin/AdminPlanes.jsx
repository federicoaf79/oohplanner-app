import { useEffect, useState } from 'react'
import { Plus, Save, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

export default function AdminPlanes() {
  const [plans, setPlans]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadPlans() }, [])

  async function loadPlans() {
    const { data } = await supabase
      .from('plans')
      .select('*')
      .order('sort_order')
    setPlans(data ?? [])
    setLoading(false)
  }

  async function handleSave(plan) {
    setSaving(plan.id)
    // eslint-disable-next-line no-unused-vars
    const { id, created_at, ...updates } = plan
    await supabase
      .from('plans')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    setSaving(null)
  }

  async function handleCreate() {
    setCreating(true)
    const slug = `plan-${Date.now()}`
    const { data } = await supabase
      .from('plans')
      .insert({
        name: 'Nuevo Plan',
        slug,
        price_usd: 0,
        max_users: 5,
        max_inventory: 50,
        max_proposals_per_month: 20,
        features: [],
        sort_order: plans.length + 1,
      })
      .select()
      .single()
    if (data) setPlans(prev => [...prev, data])
    setCreating(false)
  }

  function updateLocal(id, field, value) {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Planes</h1>
          <p className="text-sm text-slate-500">Configuración de planes disponibles en la plataforma</p>
        </div>
        <Button onClick={handleCreate} loading={creating} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Crear plan
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            saving={saving === plan.id}
            onChange={(field, value) => updateLocal(plan.id, field, value)}
            onSave={() => handleSave(plan)}
          />
        ))}
        {plans.length === 0 && (
          <p className="col-span-3 text-sm text-slate-500 py-10 text-center">
            No hay planes configurados.
          </p>
        )}
      </div>
    </div>
  )
}

function PlanCard({ plan, saving, onChange, onSave }) {
  function updateFeature(i, val) {
    const features = [...(plan.features ?? [])]
    features[i] = val
    onChange('features', features)
  }
  function addFeature() {
    onChange('features', [...(plan.features ?? []), ''])
  }
  function removeFeature(i) {
    onChange('features', (plan.features ?? []).filter((_, idx) => idx !== i))
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex-1 space-y-1.5">
          <input
            className="input-field w-full font-semibold"
            value={plan.name}
            onChange={e => onChange('name', e.target.value)}
            placeholder="Nombre del plan"
          />
          <input
            className="input-field w-full text-xs font-mono"
            value={plan.slug}
            onChange={e => onChange('slug', e.target.value)}
            placeholder="slug-del-plan"
          />
        </div>
        <button
          onClick={() => onChange('is_active', !plan.is_active)}
          title={plan.is_active ? 'Activo — click para desactivar' : 'Inactivo — click para activar'}
          className={`shrink-0 mt-1 transition-colors ${
            plan.is_active ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-600 hover:text-slate-400'
          }`}
        >
          {plan.is_active
            ? <ToggleRight className="h-7 w-7" />
            : <ToggleLeft  className="h-7 w-7" />}
        </button>
      </div>

      <div className="space-y-3">
        <Field label="Precio USD/mes">
          <input
            type="number" min="0"
            className="input-field w-full"
            value={plan.price_usd}
            onChange={e => onChange('price_usd', Number(e.target.value))}
          />
        </Field>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Max. usuarios">
            <input type="number" min="1" className="input-field w-full"
              value={plan.max_users}
              onChange={e => onChange('max_users', Number(e.target.value))} />
          </Field>
          <Field label="Max. inventario">
            <input type="number" min="1" className="input-field w-full"
              value={plan.max_inventory}
              onChange={e => onChange('max_inventory', Number(e.target.value))} />
          </Field>
          <Field label="Max. propuestas">
            <input type="number" min="1" className="input-field w-full"
              value={plan.max_proposals_per_month}
              onChange={e => onChange('max_proposals_per_month', Number(e.target.value))} />
          </Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-400">Features incluidas</label>
            <button
              onClick={addFeature}
              className="text-xs text-brand hover:text-brand/70 transition-colors"
            >
              + Agregar
            </button>
          </div>
          <div className="space-y-1.5">
            {(plan.features ?? []).map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  className="input-field flex-1 text-xs"
                  value={f}
                  onChange={e => updateFeature(i, e.target.value)}
                  placeholder="Feature…"
                />
                <button
                  onClick={() => removeFeature(i)}
                  className="shrink-0 text-slate-600 hover:text-red-400 transition-colors text-base leading-none pb-0.5"
                >
                  ×
                </button>
              </div>
            ))}
            {(plan.features ?? []).length === 0 && (
              <p className="text-xs text-slate-600 italic">Sin features — click "+ Agregar"</p>
            )}
          </div>
        </div>

        <Field label="Orden de visualización">
          <input
            type="number" min="0"
            className="input-field w-full"
            value={plan.sort_order}
            onChange={e => onChange('sort_order', Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-800">
        <Button onClick={onSave} loading={saving} size="sm" className="w-full">
          <Save className="h-4 w-4 mr-1.5" />
          Guardar cambios
        </Button>
      </div>
    </Card>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
