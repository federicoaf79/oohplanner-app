import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Sparkles, Map, Calendar, FileText, BookUser, DollarSign, Users, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const STEPS = [
  {
    icon: Sparkles,
    title: '¡Bienvenido/a a OOH Planner!',
    subtitle: 'Tu plataforma profesional para publicidad exterior',
    bullets: [
      'Gestioná tu inventario de carteles y soportes',
      'Creá propuestas para clientes en segundos',
      'Automatizá comisiones y reportes comerciales',
    ],
  },
  {
    icon: Map,
    title: 'Inventario de carteles',
    subtitle: 'El corazón de tu operación OOH',
    bullets: [
      'Cargá todos tus espacios: vallas, medianeras, pantallas y más',
      'Asigná ubicación, medidas, tipo y precio por período',
      'Controlá disponibilidad en tiempo real desde el mapa',
    ],
  },
  {
    icon: Calendar,
    title: 'Campañas',
    subtitle: 'Organizá reservas por cliente y período',
    bullets: [
      'Una campaña agrupa carteles para un cliente en un período determinado',
      'Gestioná el estado de cada cartel (activo, vencido, pendiente)',
      'Adjuntá artes y materiales para cada campaña',
    ],
  },
  {
    icon: FileText,
    title: 'Propuestas con IA',
    subtitle: 'El Planificador arma propuestas en segundos',
    bullets: [
      'Describí qué busca el cliente y el sistema selecciona los mejores carteles',
      'Generá un PDF profesional para presentar directamente al cliente',
      'Convertí las propuestas aceptadas en campañas con un solo click',
    ],
  },
  {
    icon: BookUser,
    title: 'Contactos',
    subtitle: 'Clientes, agencias y facilitadores en un lugar',
    bullets: [
      'Registrá empresas, agencias y contactos comerciales',
      'Asigná roles: cliente, agencia, facilitador, proveedor',
      'Marcá contactos como confidenciales para mayor privacidad',
    ],
  },
  {
    icon: DollarSign,
    title: 'Reglas comerciales',
    subtitle: 'Comisiones automáticas sin errores de cálculo',
    bullets: [
      'Configurá acuerdos con facilitadores y sus porcentajes',
      'Las comisiones se crean solas cuando aceptás una propuesta',
      'Reportes de comisiones por vendedor y por campaña',
    ],
  },
  {
    icon: Users,
    title: 'Equipo',
    subtitle: 'Roles y permisos para cada integrante',
    bullets: [
      'Invitá a dueños, gerentes, supervisores y vendedores',
      'Cada rol accede solo a lo que necesita ver',
      'Configurá comisiones y supervisores por vendedor',
    ],
  },
  {
    icon: CheckCircle2,
    title: '¡Todo listo para empezar!',
    subtitle: 'Ya tenés todo lo que necesitás',
    bullets: [
      'Empezá cargando tu inventario de carteles disponibles',
      'Si tenés dudas, revisá el centro de Soporte en el menú lateral',
      'Podés volver a ver este tutorial desde Ajustes > Mi perfil',
    ],
  },
]

export default function OnboardingTutorial() {
  const { profile, refreshProfile } = useAuth()
  const [step, setStep] = useState(0)
  const [closing, setClosing] = useState(false)

  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  async function dismiss() {
    if (closing) return
    setClosing(true)
    await supabase
      .from('profiles')
      .update({ onboarding_tutorial_seen: true })
      .eq('id', profile.id)
    refreshProfile()
  }

  function next() {
    if (isLast) { dismiss(); return }
    setStep(s => s + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-surface-700 bg-surface-800 shadow-2xl">

        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-500 hover:bg-surface-700 hover:text-slate-300 transition-colors"
          aria-label="Cerrar tutorial"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar */}
        <div className="h-1 w-full overflow-hidden rounded-t-2xl bg-surface-700">
          <div
            className="h-full bg-brand transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Icon */}
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15">
            <Icon className="h-7 w-7 text-brand" />
          </div>

          {/* Step counter */}
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-slate-500">
            Paso {step + 1} de {STEPS.length}
          </p>

          {/* Title */}
          <h2 className="text-xl font-bold text-white">{current.title}</h2>
          <p className="mt-1 text-sm text-slate-400">{current.subtitle}</p>

          {/* Bullets */}
          <ul className="mt-5 space-y-2.5">
            {current.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/20 text-[10px] font-bold text-brand">
                  {i + 1}
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-surface-700 px-6 py-4">
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={next}
            disabled={closing}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            {isLast ? 'Comenzar' : 'Siguiente'}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
