import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'

const STEPS = [
  'Analizando tu brief de campaña...',
  'Consultando carteles disponibles en CABA...',
  'Evaluando match con la audiencia objetivo...',
  'Calculando impactos y CPM...',
  'Generando Opción A — Máximo Alcance...',
  'Generando Opción B — Máximo Impacto...',
  'Finalizando propuestas...',
]

export default function WizardStep2Loading() {
  const [stepIdx, setStepIdx] = useState(0)
  const [dots, setDots] = useState('')

  useEffect(() => {
    const iv = setInterval(() => {
      setStepIdx(i => (i < STEPS.length - 1 ? i + 1 : i))
    }, 900)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const iv = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 400)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 animate-fade-in">
      {/* Animated ring */}
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-surface-700" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand animate-spin" />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/20">
          <Zap className="h-7 w-7 text-brand" />
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-xl font-bold text-white">
          Planificador IA en acción
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Claude está analizando tu campaña y el inventario disponible
        </p>
      </div>

      {/* Progress steps */}
      <div className="w-full max-w-sm space-y-2.5">
        {STEPS.map((text, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-300 ${
              i < stepIdx
                ? 'opacity-40'
                : i === stepIdx
                  ? 'bg-brand/10 border border-brand/20'
                  : 'opacity-20'
            }`}
          >
            <div className={`h-2 w-2 rounded-full shrink-0 ${
              i < stepIdx  ? 'bg-teal-500' :
              i === stepIdx ? 'bg-brand animate-pulse' :
              'bg-surface-700'
            }`} />
            <span className="text-sm text-slate-300">{text}</span>
            {i === stepIdx && (
              <span className="ml-auto text-xs text-brand w-4">{dots}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
