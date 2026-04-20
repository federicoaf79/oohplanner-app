import { useState, useEffect } from 'react'
import { X, Home, BarChart3, MapPin, FileText, BookUser, Users, DollarSign, LifeBuoy } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'

const STEPS = [
  {
    icon: Home,
    image: '/tutorial/01-welcome.png',
    title: 'Bienvenido a OOH Planner',
    description: 'Tu plataforma profesional para gestionar, planificar y vender publicidad exterior.',
    bullets: [
      'Gestioná tu inventario de carteles y soportes',
      'Creá propuestas para clientes en segundos',
      'Automatizá comisiones y reportes comerciales',
    ],
  },
  {
    icon: BarChart3,
    image: '/tutorial/02-dashboard.png',
    title: 'Dashboard',
    description: 'Desde el dashboard tenés una vista ejecutiva de toda tu operación en tiempo real.',
    bullets: [
      'KPIs de ocupación, ingresos y propuestas activas',
      'Mapa de inventario con estado de cada cartel',
      'Actividad reciente del equipo comercial',
    ],
  },
  {
    icon: MapPin,
    image: '/tutorial/03-inventory.png',
    title: 'Inventario de carteles',
    description: 'El corazón de tu operación. Cargá y gestioná todos tus espacios publicitarios.',
    bullets: [
      'Cargá vallas, medianeras, pantallas y más',
      'Asigná ubicación, medidas, tipo y precio por período',
      'Controlá disponibilidad en tiempo real desde el mapa',
    ],
  },
  {
    icon: FileText,
    image: '/tutorial/04-proposals.png',
    title: 'Planificador IA',
    description: 'El Planificador con IA arma propuestas completas y profesionales en segundos.',
    bullets: [
      'Describí qué busca el cliente y el sistema selecciona los mejores carteles',
      'Generá un PDF profesional para presentar directamente al cliente',
      'Convertí las propuestas aceptadas en campañas con un solo click',
    ],
  },
  {
    icon: BookUser,
    image: '/tutorial/05-contacts.png',
    title: 'Contactos',
    description: 'Clientes, agencias y facilitadores, todo en un solo lugar.',
    bullets: [
      'Registrá empresas, agencias y contactos comerciales',
      'Asigná roles: cliente, agencia, facilitador, proveedor',
      'Marcá contactos como confidenciales para mayor privacidad',
    ],
  },
  {
    icon: Users,
    image: '/tutorial/06-team.png',
    title: 'Equipo y comisiones',
    description: 'Roles y permisos para cada integrante, con comisiones configurables por vendedor.',
    bullets: [
      'Invitá a dueños, gerentes, supervisores y vendedores',
      'Cada rol accede solo a lo que necesita ver',
      'Configurá comisiones individuales y estructuras de supervisión',
    ],
  },
  {
    icon: DollarSign,
    image: '/tutorial/07-commercial.png',
    title: 'Acuerdos de facilitadores',
    description: 'Comisiones automáticas sin errores de cálculo ni planillas manuales.',
    bullets: [
      'Configurá acuerdos con facilitadores y sus porcentajes',
      'Las comisiones se crean solas cuando aceptás una propuesta',
      'Reportes de comisiones por vendedor y por campaña',
    ],
  },
  {
    icon: LifeBuoy,
    image: '/tutorial/08-support.png',
    title: '¿Necesitás ayuda?',
    description: 'El centro de soporte está siempre disponible para resolver tus dudas.',
    bullets: [
      'Revisá las preguntas frecuentes antes de abrir un ticket',
      'Abrí tickets de soporte directamente desde la app',
      'Podés volver a ver este tutorial desde Ajustes > Mi perfil',
    ],
    footer: 'El equipo de OOH Planner responde en menos de 24 horas hábiles.',
  },
]

export default function OnboardingTutorial() {
  const { profile, refreshProfile } = useAuth()
  const [step, setStep]         = useState(0)
  const [closing, setClosing]   = useState(false)
  const [imgError, setImgError] = useState(false)

  const current = STEPS[step]
  const Icon    = current.icon
  const isLast  = step === STEPS.length - 1

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function dismiss() {
    if (closing) return
    setClosing(true)
    await supabase
      .from('profiles')
      .update({ onboarding_tutorial_seen: true })
      .eq('id', profile.id)
    refreshProfile()
  }

  function handleNext() {
    if (isLast) { dismiss(); return }
    setStep(s => s + 1)
    setImgError(false)
  }

  function handleBack() {
    setStep(s => s - 1)
    setImgError(false)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-surface-900 ring-1 ring-white/10 shadow-2xl">

          {/* Close button */}
          <button
            onClick={dismiss}
            className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-surface-700/80 hover:text-slate-300 transition-colors"
            aria-label="Cerrar tutorial"
          >
            <X className="h-4 w-4" />
          </button>

          {/* 2-column grid: 60% image / 40% content */}
          <div className="grid max-h-[90vh] md:grid-cols-[3fr_2fr]">

            {/* LEFT — Image */}
            <div
              className="w-full bg-slate-950"
              style={{ aspectRatio: '1920/864' }}
            >
              {!imgError ? (
                <img
                  key={step}
                  src={current.image}
                  alt={current.title}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15">
                    <Icon className="h-8 w-8 text-brand" />
                  </div>
                  <p className="text-xs text-slate-600">Vista previa no disponible</p>
                </div>
              )}
            </div>

            {/* RIGHT — Content */}
            <div className="flex flex-col justify-between overflow-y-auto p-6 md:p-8">

              <div>
                {/* Icon + step counter */}
                <div className="flex items-center gap-2.5">
                  <Icon className="h-5 w-5 shrink-0 text-brand" />
                  <p className="text-xs font-medium text-slate-500">
                    Paso {step + 1} de {STEPS.length}
                  </p>
                </div>

                {/* Title + description */}
                <h2 className="mt-3 text-xl font-semibold text-white">{current.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{current.description}</p>

                {/* Bullets */}
                <ul className="mt-4 space-y-2">
                  {current.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                      {b}
                    </li>
                  ))}
                </ul>

                {current.footer && (
                  <p className="mt-3 text-xs italic text-slate-500">{current.footer}</p>
                )}
              </div>

              {/* Footer: progress dots + navigation */}
              <div className="mt-6">
                <div className="flex gap-1.5">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                        i <= step ? 'bg-brand' : 'bg-surface-700'
                      }`}
                    />
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  {step > 0 ? (
                    <Button variant="ghost" onClick={handleBack} size="sm">
                      ← Atrás
                    </Button>
                  ) : (
                    <div />
                  )}

                  <div className="flex gap-2">
                    {!isLast && (
                      <Button variant="ghost" onClick={dismiss} size="sm">
                        Saltar
                      </Button>
                    )}
                    <Button onClick={handleNext} disabled={closing} size="sm">
                      {isLast ? 'Empezar' : 'Siguiente →'}
                    </Button>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
