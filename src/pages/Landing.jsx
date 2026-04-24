import { Link } from 'react-router-dom'
import {
  ArrowRight, MapPin, FileText, Users,
  CheckCircle, Star, ChevronRight, TrendingUp, Shield,
  Sparkles, DollarSign, Upload,
} from 'lucide-react'

const FEATURES = [
  { icon: Sparkles,   title: 'Planificador IA',          desc: 'IA que analiza tu inventario real y genera dos estrategias — máximo alcance o máximo impacto — con audiencias y CPM en segundos.',     color: 'bg-blue-500/10 text-blue-400' },
  { icon: DollarSign, title: 'Rentabilidad en vivo',     desc: 'Margen por cartel y campaña calculado con costos fijos prorrateados + variables + comisiones. Siempre actualizado, sin planillas.',    color: 'bg-amber-500/10 text-amber-400' },
  { icon: FileText,   title: 'Propuestas profesionales', desc: 'PDF branded con mapa, audiencias, mockups del arte sobre el cartel real, y desglose financiero. Compartible por WhatsApp.',              color: 'bg-purple-500/10 text-purple-400' },
  { icon: MapPin,     title: 'Inventario completo',      desc: 'Fotos, GPS, costos, ocupación en tiempo real, corredores. Importación masiva desde Excel con deduplicación y rollback.',                color: 'bg-cyan-500/10 text-cyan-400' },
  { icon: Users,      title: 'Equipo y comisiones',      desc: 'Owner, manager, vendedor. Comisiones automáticas al cerrar venta. Reportes confidenciales según rol.',                                   color: 'bg-rose-500/10 text-rose-400' },
  { icon: Upload,     title: 'Onboarding masivo',        desc: 'Importá inventario, contactos y equipo desde Excel/CSV/PDF con reconciliación inteligente. Si algo sale mal, rollback con un clic.',    color: 'bg-indigo-500/10 text-indigo-400' },
]

function IllustrationEspectacular() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-20" fill="none">
      <rect x="10" y="50" width="8" height="28" fill="#3b5bdb" rx="1"/>
      <rect x="102" y="50" width="8" height="28" fill="#3b5bdb" rx="1"/>
      <rect x="8" y="18" width="104" height="34" rx="3" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.5"/>
      <rect x="12" y="22" width="96" height="26" rx="2" fill="#1d4ed8"/>
      <rect x="16" y="25" width="40" height="4" rx="1" fill="#60a5fa"/>
      <rect x="16" y="32" width="28" height="3" rx="1" fill="#3b82f6" opacity="0.6"/>
      <rect x="60" y="24" width="44" height="20" rx="2" fill="#2563eb"/>
      <circle cx="82" cy="34" r="7" fill="#3b82f6" opacity="0.4"/>
      <circle cx="82" cy="34" r="4" fill="#60a5fa"/>
      <rect x="4" y="14" width="112" height="4" rx="1" fill="#1e40af"/>
      <rect x="18" y="70" width="84" height="3" rx="1" fill="#1e3a8a"/>
    </svg>
  )
}

function IllustrationDigital() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-20" fill="none">
      <rect x="30" y="8" width="60" height="52" rx="4" fill="#1e1b4b" stroke="#7c3aed" strokeWidth="1.5"/>
      <rect x="34" y="12" width="52" height="44" rx="2" fill="#2e1065"/>
      <rect x="38" y="16" width="44" height="36" rx="1" fill="#0f0a2e"/>
      <rect x="40" y="20" width="20" height="3" rx="1" fill="#a78bfa"/>
      <rect x="40" y="26" width="30" height="2" rx="1" fill="#7c3aed" opacity="0.7"/>
      <rect x="40" y="30" width="25" height="2" rx="1" fill="#7c3aed" opacity="0.5"/>
      <rect x="62" y="19" width="16" height="16" rx="2" fill="#4c1d95"/>
      <circle cx="70" cy="27" r="5" fill="#7c3aed" opacity="0.5"/>
      <circle cx="70" cy="27" r="2.5" fill="#a78bfa"/>
      <rect x="38" y="46" width="44" height="4" rx="1" fill="#4c1d95"/>
      <rect x="50" y="60" width="20" height="4" rx="1" fill="#3b0764"/>
      <rect x="48" y="64" width="24" height="8" rx="1" fill="#1e1b4b"/>
      <circle cx="42" cy="68" r="2" fill="#7c3aed" opacity="0.8"/>
      <circle cx="78" cy="68" r="2" fill="#7c3aed" opacity="0.8"/>
    </svg>
  )
}

function IllustrationMedianera() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-20" fill="none">
      <rect x="15" y="10" width="90" height="68" rx="2" fill="#042f2e" stroke="#14b8a6" strokeWidth="1"/>
      {[25,40,55,70,85].map((x, i) => (
        <g key={i}>
          <rect x={x} y="15" width="10" height="8" rx="1" fill="#134e4a"/>
          <rect x={x} y="30" width="10" height="8" rx="1" fill="#134e4a"/>
        </g>
      ))}
      <rect x="18" y="42" width="84" height="30" rx="1" fill="#134e4a" stroke="#2dd4bf" strokeWidth="1"/>
      <rect x="21" y="45" width="78" height="24" rx="1" fill="#022c22"/>
      <rect x="24" y="48" width="35" height="4" rx="1" fill="#2dd4bf"/>
      <rect x="24" y="55" width="25" height="3" rx="1" fill="#14b8a6" opacity="0.6"/>
      <rect x="62" y="47" width="34" height="18" rx="1" fill="#134e4a"/>
      <circle cx="79" cy="56" r="6" fill="#14b8a6" opacity="0.3"/>
      <circle cx="79" cy="56" r="3" fill="#2dd4bf" opacity="0.7"/>
    </svg>
  )
}

function IllustrationAfiche() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-20" fill="none">
      <rect x="58" y="12" width="4" height="60" rx="1" fill="#92400e"/>
      <rect x="25" y="8" width="70" height="45" rx="3" fill="#78350f" stroke="#f59e0b" strokeWidth="1.5"/>
      <rect x="28" y="11" width="64" height="39" rx="2" fill="#451a03"/>
      <rect x="31" y="14" width="58" height="33" rx="1" fill="#292524"/>
      <rect x="34" y="17" width="25" height="5" rx="1" fill="#f59e0b"/>
      <rect x="34" y="25" width="40" height="3" rx="1" fill="#d97706" opacity="0.7"/>
      <rect x="34" y="30" width="32" height="3" rx="1" fill="#d97706" opacity="0.5"/>
      <rect x="62" y="16" width="24" height="20" rx="1" fill="#3d2b00"/>
      <circle cx="74" cy="26" r="7" fill="#f59e0b" opacity="0.3"/>
      <circle cx="74" cy="26" r="3.5" fill="#fbbf24"/>
      <rect x="40" y="72" width="40" height="4" rx="2" fill="#78350f"/>
    </svg>
  )
}

function IllustrationMobiliario() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-20" fill="none">
      <rect x="20" y="20" width="80" height="50" rx="2" fill="#881337" stroke="#fb7185" strokeWidth="1"/>
      <rect x="16" y="16" width="88" height="8" rx="2" fill="#9f1239"/>
      <rect x="25" y="25" width="40" height="35" rx="1" fill="#4c0519"/>
      <rect x="28" y="28" width="34" height="29" rx="1" fill="#1a0008"/>
      <rect x="30" y="31" width="18" height="4" rx="1" fill="#fb7185"/>
      <rect x="30" y="38" width="26" height="2" rx="1" fill="#f43f5e" opacity="0.6"/>
      <rect x="30" y="43" width="20" height="2" rx="1" fill="#f43f5e" opacity="0.4"/>
      <circle cx="82" cy="38" r="5" fill="#9f1239"/>
      <rect x="78" y="44" width="8" height="14" rx="2" fill="#9f1239"/>
      <rect x="15" y="70" width="90" height="4" rx="1" fill="#4c0519"/>
    </svg>
  )
}

function IllustrationMovil() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-20" fill="none">
      <rect x="8" y="40" width="60" height="28" rx="3" fill="#134e4a" stroke="#14b8a6" strokeWidth="1"/>
      <rect x="68" y="48" width="26" height="20" rx="3" fill="#0d3d39"/>
      <rect x="70" y="50" width="22" height="14" rx="2" fill="#0f766e"/>
      <rect x="11" y="43" width="54" height="22" rx="2" fill="#042f2e"/>
      <rect x="13" y="45" width="50" height="18" rx="1" fill="#022020"/>
      <rect x="15" y="47" width="22" height="4" rx="1" fill="#14b8a6"/>
      <rect x="15" y="54" width="30" height="2" rx="1" fill="#0d9488" opacity="0.7"/>
      <rect x="40" y="46" width="20" height="14" rx="1" fill="#0a3d3a"/>
      <circle cx="50" cy="53" r="5" fill="#14b8a6" opacity="0.4"/>
      <circle cx="50" cy="53" r="2.5" fill="#2dd4bf"/>
      <circle cx="25" cy="70" r="7" fill="#042f2e" stroke="#14b8a6" strokeWidth="1.5"/>
      <circle cx="25" cy="70" r="3" fill="#0d9488"/>
      <circle cx="55" cy="70" r="7" fill="#042f2e" stroke="#14b8a6" strokeWidth="1.5"/>
      <circle cx="55" cy="70" r="3" fill="#0d9488"/>
      <circle cx="82" cy="70" r="6" fill="#042f2e" stroke="#14b8a6" strokeWidth="1.5"/>
      <circle cx="82" cy="70" r="2.5" fill="#0d9488"/>
      <path d="M95 30 Q100 25 105 30" stroke="#14b8a6" strokeWidth="1.5" fill="none" opacity="0.8"/>
      <path d="M92 26 Q100 18 108 26" stroke="#14b8a6" strokeWidth="1" fill="none" opacity="0.5"/>
      <circle cx="100" cy="35" r="2" fill="#14b8a6" opacity="0.8"/>
    </svg>
  )
}

const FORMATS = [
  { name: 'Espectaculares', desc: 'Carteles de gran formato iluminados en rutas y avenidas principales. Máximo impacto visual.', color: 'from-blue-900/40 to-blue-950/20 border-blue-500/30', badge: 'bg-blue-500/20 text-blue-300', Illustration: IllustrationEspectacular },
  { name: 'Digitales LED', desc: 'Pantallas electrónicas con rotación de spots. Contenido dinámico y actualización en tiempo real.', color: 'from-purple-900/40 to-purple-950/20 border-purple-500/30', badge: 'bg-purple-500/20 text-purple-300', Illustration: IllustrationDigital },
  { name: 'Medianeras', desc: 'Carteles pintados o impresos en paredes de edificios. Alta permanencia y visibilidad urbana.', color: 'from-teal-900/40 to-teal-950/20 border-teal-500/30', badge: 'bg-teal-500/20 text-teal-300', Illustration: IllustrationMedianera },
  { name: 'Afiches', desc: 'Cartelería de papel en soportes urbanos. Alta frecuencia de impacto en zonas peatonales.', color: 'from-amber-900/40 to-amber-950/20 border-amber-500/30', badge: 'bg-amber-500/20 text-amber-300', Illustration: IllustrationAfiche },
  { name: 'Mobiliario Urbano', desc: 'Paradas de colectivo, kioscos y refugios. Contacto directo con el peatón en su recorrido diario.', color: 'from-rose-900/40 to-rose-950/20 border-rose-500/30', badge: 'bg-rose-500/20 text-rose-300', Illustration: IllustrationMobiliario },
  { name: 'Pantallas Móviles', desc: 'Pantallas digitales en movimiento posicionadas en zonas de calor según la audiencia objetivo.', color: 'from-teal-900/40 to-teal-950/20 border-teal-500/30', badge: 'bg-teal-500/20 text-teal-300', Illustration: IllustrationMovil },
]

// TODO: reactivar cuando haya data real (demo 25/04/2026)
// eslint-disable-next-line no-unused-vars
const PLANS = [
  {
    name: 'Starter', price: '$ARS 400.000', desc: 'Perfecto para dueños con inventario pequeño-mediano',
    features: ['Hasta 5 usuarios', '50 espacios en inventario', '20 propuestas/mes', 'Soporte por email'],
    highlighted: false, cta: 'Comenzar',
  },
  {
    name: 'Pro', price: '$ARS 780.000', desc: 'Para equipos en crecimiento',
    features: ['Hasta 15 usuarios', '200 espacios en inventario', '100 propuestas/mes', 'Reportes avanzados', 'Soporte prioritario'],
    highlighted: true, cta: 'Comenzar',
  },
  {
    name: 'Custom', price: 'A medida', desc: 'Para grandes operaciones',
    features: ['Usuarios ilimitados', 'Inventario ilimitado', 'Propuestas ilimitadas', 'Customización total', 'Onboarding dedicado'],
    highlighted: false, cta: 'Contactanos',
  },
]

// TODO: reactivar cuando haya data real (demo 25/04/2026)
// eslint-disable-next-line no-unused-vars
const TESTIMONIALS = [
  { name: 'Carlos Mendoza', role: 'Director Comercial, Medios del Norte', text: 'OOH Planner nos permitió reducir el tiempo de preparación de propuestas de 3 días a 2 horas. Increíble.', stars: 5 },
  { name: 'María Torres', role: 'CEO, UrbanAds MX', text: 'Finalmente una plataforma pensada para el mercado OOH. El inventario georeferenciado es un game changer.', stars: 5 },
  { name: 'Andrés Reyes', role: 'Manager de Ventas, OutdoorPro', text: 'Los reportes automáticos que enviamos a los clientes dan una imagen muy profesional. Los clientes lo notan.', stars: 5 },
]

export default function Landing() {
  return (
    <div className="min-h-svh bg-surface-900 text-slate-100">

      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-surface-700/50 bg-surface-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
          <img src="/logo.png" alt="OOH Planner" className="h-24 w-auto" />
          <div className="hidden items-center gap-8 md:flex">
            {['Características', 'Formatos'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-slate-400 transition-colors hover:text-white">{item}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-ghost text-sm">Ingresar</Link>
            <Link to="/register" className="btn-primary text-sm">
              Registrarse <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-24 pt-32 lg:px-8 lg:pb-32 lg:pt-40">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-sm text-brand">
            <TrendingUp className="h-3.5 w-3.5" />
            Diseñada en Argentina para el mercado OOH local
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            La plataforma completa para gestionar tu negocio de{' '}
            <span className="text-brand">vía pública</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Administración inteligente de inventario, planificación con IA y audiencias,
            control total de costos y rentabilidad. Todo en un solo lugar.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
            Pensada para dueños de portfolios pequeños y medianos.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href="mailto:hola@oohplanner.net" className="btn-primary text-base px-6 py-3">
              Solicitá una demo
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-600">Respondemos en 24hs hábiles</p>
        </div>
      </section>

      {/* La plataforma en acción — 3 pasos del flow end-to-end */}
      <section className="relative overflow-hidden px-4 py-16 lg:px-8 lg:py-20 bg-surface-800/30 border-t border-surface-700">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 right-10 h-[400px] w-[400px] rounded-full bg-brand/5 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-white lg:text-3xl">La plataforma en acción</h2>
            <p className="mt-3 text-slate-400">Del brief del cliente a la campaña activa, en tres pasos.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Planificá con IA',
                desc: 'Cargá el brief del cliente. El Planificador IA analiza tu inventario real y propone dos estrategias — máximo alcance o máximo impacto — con audiencias y CPM calculados.',
              },
              {
                step: '02',
                title: 'Propuesta profesional',
                desc: 'PDF branded con mapa de ubicaciones, métricas de audiencia, mockups del arte del cliente sobre el cartel real, y desglose financiero. Compartible por WhatsApp.',
              },
              {
                step: '03',
                title: 'Ciclo completo',
                desc: 'Aprobada → impresión → colocación → activa → retirada. Workflow visual, alertas de vencimiento, comisiones automáticas al cerrar venta.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="card p-6 transition-colors hover:border-brand/30">
                <span className="text-xs font-bold tracking-widest text-brand">{step}</span>
                <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="características" className="px-4 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-white lg:text-4xl">Todo lo que necesitas, en un solo lugar</h2>
            <p className="mt-4 text-slate-400">Diseñado para dueños de inventario y operadores de vía pública.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="card p-6 transition-all hover:border-brand/30 hover:-translate-y-0.5">
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formatos OOH */}
      <section id="formatos" className="px-4 py-20 lg:px-8 lg:py-28 bg-surface-800/30 border-y border-surface-700">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-white lg:text-4xl">Todos los formatos de vía pública</h2>
            <p className="mt-4 text-slate-400">Gestioná tu inventario sin importar el formato. Desde espectaculares hasta pantallas móviles.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FORMATS.map(({ name, desc, color, badge, Illustration }) => (
              <div key={name} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 transition-all hover:-translate-y-0.5 ${color}`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge}`}>{name}</span>
                </div>
                <div className="mb-4">
                  <Illustration />
                </div>
                <h3 className="mb-1.5 text-base font-semibold text-white">{name}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gestión administrativa completa */}
      <section className="px-4 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-sm text-brand">
              <CheckCircle className="h-3.5 w-3.5" />
              Administración completa
            </div>
            <h2 className="text-2xl font-bold text-white lg:text-3xl">Gestión Administrativa Completa</h2>
            <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
              Todo lo necesario para operar un portfolio de vía pública con control total del negocio.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              'Inventario completo: Sube rápidamente todo tu inventario de pantallas y formatos que administras, propio o de terceros, por medio de nuestro sistema de macheo automático de ubicaciones.',
              'Sistema de comisiones: Escala de comisiones a todo el nivel de la empresa y participación dentro de la operación.',
              'Migración de datos: Sube archivos de múltiples fuentes de forma fácil y segura.',
              'Reportes y analítica: Toda la información de tu operación en un solo lugar, con cuadros comparativos y analítica.',
              'Alertas Administrativas: El sistema te avisa vencimientos de contratos, posiciones, acuerdos, y mucho más.',
              'Gestión de contactos: Administra clientes, agencias y proveedores con roles diferenciados.',
            ].map((item, i) => (
              <div key={i} className="card p-5 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-brand mt-0.5 shrink-0" />
                <p className="text-sm text-slate-300 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow completo de campaña */}
      <section className="relative px-4 py-20 lg:px-8 lg:py-28 bg-surface-800/30 border-y border-surface-700">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-sm text-brand">
              <ArrowRight className="h-3.5 w-3.5" />
              Ciclo completo de venta
            </div>
            <h2 className="text-2xl font-bold text-white lg:text-3xl">Workflow visual, de punta a punta</h2>
            <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
              Cada propuesta aprobada avanza por 6 estados trackeables. Con alertas automáticas,
              comisiones al cerrar, y retiro por vencimiento.
            </p>
          </div>

          {/* Stepper — pills + arrows mimicking the in-app WorkflowStepper */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto">
            {[
              { label: 'Aprobada',   cls: 'border-teal-500/40 bg-teal-500/10 text-teal-400' },
              { label: 'Impresión',  cls: 'border-blue-500/40 bg-blue-500/10 text-blue-400' },
              { label: 'Colocación', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-400' },
              { label: 'Activa',     cls: 'border-brand/40 bg-brand/10 text-brand' },
              { label: 'Renovada',   cls: 'border-purple-500/40 bg-purple-500/10 text-purple-400' },
              { label: 'Retirada',   cls: 'border-slate-600 bg-slate-500/10 text-slate-400' },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${step.cls}`}>
                  {step.label}
                </span>
                {i < arr.length - 1 && <ChevronRight className="h-4 w-4 text-slate-600" />}
              </div>
            ))}
          </div>

          {/* Key metrics */}
          <div className="mt-12 grid gap-6 sm:grid-cols-3 max-w-3xl mx-auto text-center">
            <div>
              <p className="text-3xl font-bold bg-gradient-to-r from-brand to-purple-400 bg-clip-text text-transparent">60d</p>
              <p className="mt-2 text-xs text-slate-500">Aviso automático de vencimiento</p>
            </div>
            <div>
              <p className="text-3xl font-bold bg-gradient-to-r from-brand to-purple-400 bg-clip-text text-transparent">Auto</p>
              <p className="mt-2 text-xs text-slate-500">Comisiones al cerrar venta</p>
            </div>
            <div>
              <p className="text-3xl font-bold bg-gradient-to-r from-brand to-purple-400 bg-clip-text text-transparent">Stepper</p>
              <p className="mt-2 text-xs text-slate-500">Tracking visual en cada card</p>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="px-4 py-16 lg:px-8 bg-surface-800/20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-sm text-teal-400">
              <Shield className="h-3.5 w-3.5" />
              Seguridad y privacidad
            </div>
            <h2 className="text-2xl font-bold text-white lg:text-3xl">Tus datos son solo tuyos</h2>
            <p className="mt-3 text-slate-400 max-w-2xl mx-auto">Construida con Row Level Security desde el día uno. Cada empresa opera en un espacio completamente aislado.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: '🔒', title: 'Aislamiento total', desc: 'Cada organización tiene sus propios datos. RLS aplicado a nivel de base de datos.' },
              { icon: '🔐', title: 'Encriptación AES-256', desc: 'Datos en reposo encriptados. Comunicación siempre por HTTPS/TLS.' },
              { icon: '👁️', title: 'Sin acceso de terceros', desc: 'OOH Planner no accede a tus datos operativos. Tus carteles y contratos son privados.' },
              { icon: '🛡️', title: 'Auth segura', desc: 'Tokens JWT con refresh automático. Sesiones expiradas notificadas al usuario.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="card p-5">
                <div className="mb-3 text-2xl">{icon}</div>
                <p className="text-sm font-semibold text-white mb-1">{title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof — hidden for demo, reactivate when real customers exist */}
      {/*
      <section className="border-y border-surface-700 bg-surface-800/50 px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-8">Utilizado por operadores líderes de OOH</p>
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
            {['MediaGroup', 'OutdoorPro', 'UrbanAds', 'MediosMX', 'SignalOOH'].map(name => (
              <span key={name} className="text-lg font-bold text-slate-600">{name}</span>
            ))}
          </div>
        </div>
      </section>
      */}

      {/* Testimonials — hidden for demo, reactivate when real testimonials exist */}
      {/*
      <section id="testimonios" className="px-4 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-white lg:text-4xl">Lo que dicen nuestros clientes</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map(({ name, role, text, stars }) => (
              <div key={name} className="card p-6">
                <div className="mb-4 flex">
                  {Array(stars).fill(0).map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="mb-4 text-sm text-slate-300 leading-relaxed">"{text}"</p>
                <div>
                  <p className="text-sm font-semibold text-white">{name}</p>
                  <p className="text-xs text-slate-500">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      */}

      {/* Pricing — hidden for demo, reactivate when pricing is locked in */}
      {/*
      <section id="precios" className="px-4 py-20 lg:px-8 lg:py-28 bg-surface-800/20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-white lg:text-4xl">Precios claros y justos</h2>
            <p className="mt-4 text-slate-400">Elegí el plan que mejor se adapta a tu operación.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {PLANS.map(({ name, price, desc, features, highlighted, cta }) => (
              <div key={name} className={`card p-6 relative ${highlighted ? 'border-brand ring-1 ring-brand/50' : ''}`}>
                {highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">Más popular</span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white">{name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{desc}</p>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-white">{price}</span>
                    {price !== 'A medida' && <span className="text-slate-500 mb-1">/mes</span>}
                  </div>
                </div>
                <ul className="mb-6 space-y-3">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle className="h-4 w-4 shrink-0 text-teal-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={name === 'Custom' ? 'mailto:hola@oohplanner.net' : '/register'}
                  className={highlighted ? 'btn-primary w-full justify-center' : 'btn-secondary w-full justify-center'}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
      */}

      {/* CTA */}
      <section className="px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rounded-2xl border border-brand/20 bg-brand/5 p-10">
            <h2 className="text-3xl font-bold text-white">Transformá tu operación OOH hoy mismo</h2>
            <p className="mt-4 text-slate-400">Gestioná tu inventario, vendé mejor, y tené control real de tu rentabilidad.</p>
            <a href="mailto:hola@oohplanner.net" className="btn-primary mt-8 inline-flex text-base px-8 py-3">
              Contactanos
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-700 px-4 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <img src="/logo2.png" alt="OOH Planner" className="h-28 w-auto" />
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} OOH Planner. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
