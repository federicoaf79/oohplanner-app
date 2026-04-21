import { useState } from 'react'
import { ArrowLeft, Zap, Target, ChevronRight } from 'lucide-react'

const STRATEGIES = [
  {
    key: 'A',
    icon: Zap,
    title: 'Máximo Alcance',
    subtitle: 'Más carteles, mayor cobertura territorial',
    description: 'Prioriza la distribución geográfica diversa con mix de formatos. Ideal para campañas de awareness masivo donde la presencia en múltiples zonas es clave.',
    bullets: ['Mayor cantidad de soportes', 'Cobertura zonal amplia', 'Mix equilibrado de formatos', 'CPM competitivo'],
    color: 'brand',
    emoji: '⚡',
  },
  {
    key: 'B',
    icon: Target,
    title: 'Máximo Impacto',
    subtitle: 'Menos carteles, ubicaciones premium',
    description: 'Concentra la inversión en los soportes de mayor tráfico y audiencia ABC1. Ideal para marcas premium que buscan visibilidad de alto impacto en corredores principales.',
    bullets: ['Ubicaciones de alto tráfico', 'Audiencia calificada ABC1', 'Mayor visibilidad por soporte', 'CPM premium justificado'],
    color: 'teal',
    emoji: '🎯',
  },
]

export default function WizardStep2Strategy({ onSelect, onBack }) {
  const [hovering, setHovering] = useState(null)

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">¿Qué tipo de pauta querés generar?</h2>
        <p className="text-sm text-slate-500">
          Elegí la estrategia antes de planificar. Esto define cómo la IA va a seleccionar y priorizar los carteles.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STRATEGIES.map(s => {
          const Icon = s.icon
          const isHovered = hovering === s.key
          const borderColor = s.color === 'brand' ? 'border-brand/60' : 'border-teal-500/60'
          const bgColor = s.color === 'brand' ? 'bg-brand/5' : 'bg-teal-500/5'
          const iconColor = s.color === 'brand' ? 'text-brand' : 'text-teal-400'
          const badgeColor = s.color === 'brand' ? 'bg-brand/15 text-brand' : 'bg-teal-500/15 text-teal-400'
          const btnColor = s.color === 'brand'
            ? 'bg-brand hover:bg-brand/90 text-white'
            : 'bg-teal-600 hover:bg-teal-500 text-white'

          return (
            <button
              key={s.key}
              onClick={() => onSelect(s.key)}
              onMouseEnter={() => setHovering(s.key)}
              onMouseLeave={() => setHovering(null)}
              className={`
                text-left rounded-2xl border p-6 transition-all duration-200 group
                ${isHovered ? `${borderColor} ${bgColor} shadow-lg scale-[1.01]` : 'border-surface-700 bg-surface-800/50 hover:border-surface-600'}
              `}
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className={`rounded-xl p-2.5 ${isHovered ? (s.color === 'brand' ? 'bg-brand/20' : 'bg-teal-500/20') : 'bg-surface-700'} transition-colors`}>
                  <Icon className={`h-5 w-5 ${isHovered ? iconColor : 'text-slate-400'} transition-colors`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-base">{s.emoji}</span>
                    <h3 className="text-base font-bold text-white">{s.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500">{s.subtitle}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-slate-400 leading-relaxed mb-4">{s.description}</p>

              {/* Bullets */}
              <ul className="space-y-1.5 mb-5">
                {s.bullets.map((b, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isHovered ? (s.color === 'brand' ? 'bg-brand' : 'bg-teal-400') : 'bg-slate-600'} transition-colors`} />
                    {b}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className={`
                flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-semibold transition-all
                ${isHovered ? btnColor : 'bg-surface-700 text-slate-400'}
              `}>
                Planificar con esta estrategia
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          )
        })}
      </div>

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al brief
      </button>
    </div>
  )
}
