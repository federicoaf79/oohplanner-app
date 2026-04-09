import { Link } from 'react-router-dom'
import {
  Zap, ArrowRight, MapPin, BarChart2, FileText, Users,
  CheckCircle, Star, ChevronRight, Megaphone, TrendingUp, Shield
} from 'lucide-react'

const FEATURES = [
  {
    icon: Megaphone,
    title: 'Gestión de Campañas',
    desc: 'Crea, monitorea y optimiza campañas OOH con visibilidad total en tiempo real.',
    color: 'bg-blue-500/10 text-blue-400',
  },
  {
    icon: MapPin,
    title: 'Inventario Inteligente',
    desc: 'Administra tu cartera de espacios publicitarios con geoposicionamiento y métricas de tráfico.',
    color: 'bg-emerald-500/10 text-emerald-400',
  },
  {
    icon: FileText,
    title: 'Propuestas Profesionales',
    desc: 'Genera propuestas impactantes en minutos y envíalas directamente al cliente.',
    color: 'bg-purple-500/10 text-purple-400',
  },
  {
    icon: BarChart2,
    title: 'Reportes y Analytics',
    desc: 'Visualiza el desempeño de tus campañas con dashboards ejecutivos y reportes automáticos.',
    color: 'bg-amber-500/10 text-amber-400',
  },
  {
    icon: Users,
    title: 'Multi-rol y Equipos',
    desc: 'Colabora con tu equipo: owners, managers y vendedores con permisos diferenciados.',
    color: 'bg-rose-500/10 text-rose-400',
  },
  {
    icon: Shield,
    title: 'Seguridad Multi-tenant',
    desc: 'Cada empresa opera en un espacio completamente aislado. Tus datos son solo tuyos.',
    color: 'bg-teal-500/10 text-teal-400',
  },
]

const FORMATS = [
  {
    emoji: '🏗️',
    name: 'Espectaculares',
    desc: 'Carteles de gran formato iluminados en rutas y avenidas principales. Máximo impacto visual.',
    color: 'from-blue-600/20 to-blue-800/10 border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-300',
  },
  {
    emoji: '📺',
    name: 'Digitales LED',
    desc: 'Pantallas electrónicas con rotación de spots. Contenido dinámico y actualización en tiempo real.',
    color: 'from-purple-600/20 to-purple-800/10 border-purple-500/30',
    badge: 'bg-purple-500/20 text-purple-300',
  },
  {
    emoji: '🏢',
    name: 'Medianeras',
    desc: 'Carteles pintados o impresos en paredes de edificios. Alta permanencia y visibilidad urbana.',
    color: 'from-emerald-600/20 to-emerald-800/10 border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300',
  },
  {
    emoji: '📋',
    name: 'Afiches',
    desc: 'Cartelería de papel en soportes urbanos. Alta frecuencia de impacto en zonas peatonales.',
    color: 'from-amber-600/20 to-amber-800/10 border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300',
  },
  {
    emoji: '🚏',
    name: 'Mobiliario Urbano',
    desc: 'Paradas de colectivo, kioscos y refugios. Contacto directo con el peatón en su recorrido diario.',
    color: 'from-rose-600/20 to-rose-800/10 border-rose-500/30',
    badge: 'bg-rose-500/20 text-rose-300',
  },
  {
    emoji: '🚛',
    name: 'Pantallas Móviles',
    desc: 'Pantallas digitales en movimiento que se posicionan en zonas de calor según la audiencia objetivo.',
    color: 'from-teal-600/20 to-teal-800/10 border-teal-500/30',
    badge: 'bg-teal-500/20 text-teal-300',
  },
]

const PLANS = [
  {
    name: 'Starter',
    price: '$200',
    desc: 'Perfecto para agencias pequeñas',
    features: [
      'Hasta 5 usuarios',
      '50 espacios en inventario',
      '20 propuestas/mes',
      'Soporte por email',
    ],
    highlighted: false,
    cta: 'Comenzar',
  },
  {
    name: 'Pro',
    price: '$450',
    desc: 'Para equipos en crecimiento',
    features: [
      'Hasta 15 usuarios',
      '200 espacios en inventario',
      '100 propuestas/mes',
      'Reportes avanzados',
      'Soporte prioritario',
    ],
    highlighted: true,
    cta: 'Comenzar',
  },
  {
    name: 'Custom',
    price: 'A medida',
    desc: 'Para grandes operaciones',
    features: [
      'Usuarios ilimitados',
      'Inventario ilimitado',
      'Propuestas ilimitadas',
      'Customización total',
      'Onboarding dedicado',
    ],
    highlighted: false,
    cta: 'Contactanos',
  },
]

const TESTIMONIALS = [
  {
    name: 'Carlos Mendoza',
    role: 'Director Comercial, Medios del Norte',
    text: 'OOH Planner nos permitió reducir el tiempo de preparación de propuestas de 3 días a 2 horas. Increíble.',
    stars: 5,
  },
  {
    name: 'María Torres',
    role: 'CEO, UrbanAds MX',
    text: 'Finalmente una plataforma pensada para el mercado OOH. El inventario georeferenciado es un game changer.',
    stars: 5,
  },
  {
    name: 'Andrés Reyes',
    role: 'Manager de Ventas, OutdoorPro',
    text: 'Los reportes automáticos que enviamos a los clientes dan una imagen muy profesional. Los clientes lo notan.',
    stars: 5,
  },
]

export default function Landing() {
  return (
    <div className="min-h-svh bg-surface-900 text-slate-100">
      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-surface-700/50 bg-surface-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold text-white">OOH Planner</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            {['Características', 'Formatos', 'Precios', 'Testimonios'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`}
                className="text-sm text-slate-400 transition-colors hover:text-white">
                {item}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-ghost text-sm">Ingresar</Link>
            <Link to="/register" className="btn-primary text-sm">
              Prueba gratis <ArrowRight className="h-3.5 w-3.5" />
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
            Plataforma #1 para gestión OOH en LATAM
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Transforma tu operación{' '}
            <span className="text-brand">OOH</span>{' '}
            con tecnología inteligente
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Gestiona campañas, inventario y propuestas de publicidad exterior en una sola plataforma.
            Más ventas, menos tiempo operativo, clientes más satisfechos.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/register" className="btn-primary text-base px-6 py-3">
              Comenzar gratis — 14 días
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-4 text-xs text-slate-600">
            Sin tarjeta de crédito · Cancelación en cualquier momento
          </p>
        </div>

        {/* App preview mockup */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="rounded-2xl border border-surface-700 bg-surface-800 p-1 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-surface-700">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
            </div>
            <div className="flex h-64 sm:h-80 lg:h-96">
              {/* Sidebar mock */}
              <div className="hidden w-48 border-r border-surface-700 p-4 sm:block">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-brand" />
                  <div className="h-3 w-20 rounded bg-surface-700" />
                </div>
                {['Dashboard','Campañas','Inventario','Propuestas'].map(item => (
                  <div key={item} className="mb-1.5 flex items-center gap-2 rounded-md px-2 py-1.5">
                    <div className="h-3 w-3 rounded bg-surface-700" />
                    <div className="h-2.5 flex-1 rounded bg-surface-700" />
                  </div>
                ))}
                <div className="mt-1.5 flex items-center gap-2 rounded-md bg-brand/10 px-2 py-1.5">
                  <div className="h-3 w-3 rounded bg-brand/40" />
                  <div className="h-2.5 w-12 rounded bg-brand/40" />
                </div>
              </div>
              {/* Main content mock */}
              <div className="flex-1 p-4">
                <div className="mb-4 grid grid-cols-4 gap-2">
                  {['bg-blue-500/20','bg-emerald-500/20','bg-purple-500/20','bg-amber-500/20'].map((c, i) => (
                    <div key={i} className={`rounded-lg ${c} p-3`}>
                      <div className="h-2 w-16 rounded bg-surface-700 mb-2" />
                      <div className="h-5 w-10 rounded bg-surface-600" />
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-surface-700 p-3">
                  <div className="h-2.5 w-32 rounded bg-surface-700 mb-3" />
                  {[90, 65, 45, 75].map((w, i) => (
                    <div key={i} className="mb-2 flex items-center gap-3">
                      <div className="h-2 w-20 rounded bg-surface-700 shrink-0" />
                      <div className="h-2 rounded bg-brand/50" style={{ width: `${w}%` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="características" className="px-4 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-white lg:text-4xl">
              Todo lo que necesitas, en un solo lugar
            </h2>
            <p className="mt-4 text-slate-400">
              Diseñado específicamente para agencias y operadores de publicidad exterior.
            </p>
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
            <h2 className="text-3xl font-bold text-white lg:text-4xl">
              Todos los formatos de vía pública
            </h2>
            <p className="mt-4 text-slate-400">
              Gestioná tu inventario sin importar el formato. Desde espectaculares hasta pantallas móviles.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FORMATS.map(({ emoji, name, desc, color, badge }) => (
              <div key={name} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 transition-all hover:-translate-y-0.5 ${color}`}>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-4xl">{emoji}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge}`}>
                    {name}
                  </span>
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">{name}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security & trust */}
      <section className="px-4 py-16 lg:px-8 bg-surface-800/20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
              <Shield className="h-3.5 w-3.5" />
              Seguridad y privacidad
            </div>
            <h2 className="text-2xl font-bold text-white lg:text-3xl">
              Tus datos son solo tuyos
            </h2>
            <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
              Construida con Row Level Security desde el día uno. Cada empresa opera en un espacio completamente aislado.
            </p>
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

      {/* Social proof */}
      <section className="border-y border-surface-700 bg-surface-800/50 px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-8">
            Utilizado por agencias líderes
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
            {['MediaGroup', 'OutdoorPro', 'UrbanAds', 'MediosMX', 'SignalOOH'].map(name => (
              <span key={name} className="text-lg font-bold text-slate-600">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonios" className="px-4 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-white lg:text-4xl">Lo que dicen nuestros clientes</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map(({ name, role, text, stars }) => (
              <div key={name} className="card p-6">
                <div className="mb-4 flex">
                  {Array(stars).fill(0).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
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

      {/* Pricing */}
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
                    <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
                      Más popular
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white">{name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{desc}</p>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-white">{price}</span>
                    {price !== 'A medida' && <span className="text-slate-500 mb-1">/mes USD</span>}
                  </div>
                </div>
                <ul className="mb-6 space-y-3">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
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

      {/* CTA */}
      <section className="px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rounded-2xl border border-brand/20 bg-brand/5 p-10">
            <h2 className="text-3xl font-bold text-white">
              Transformá tu agencia hoy mismo
            </h2>
            <p className="mt-4 text-slate-400">
              Únete a más de 200 agencias que ya gestionan su operación OOH con nosotros.
            </p>
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
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-bold text-white">OOH Planner</span>
          </div>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} OOH Planner. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
