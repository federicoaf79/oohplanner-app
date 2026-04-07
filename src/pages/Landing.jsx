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

const PLANS = [
  {
    name: 'Starter',
    price: '$49',
    desc: 'Perfecto para agencias pequeñas',
    features: ['Hasta 3 usuarios', '50 espacios en inventario', '10 propuestas/mes', 'Soporte por email'],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$149',
    desc: 'Para equipos en crecimiento',
    features: ['Hasta 15 usuarios', 'Inventario ilimitado', 'Propuestas ilimitadas', 'Reportes avanzados', 'Soporte prioritario'],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    desc: 'Para grandes operaciones',
    features: ['Usuarios ilimitados', 'API access', 'SSO / SAML', 'SLA garantizado', 'Onboarding dedicado'],
    highlighted: false,
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
            {['Características', 'Precios', 'Testimonios'].map(item => (
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
        {/* BG glow */}
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
            <Link to="/login" className="btn-secondary text-base px-6 py-3">
              Ver demo en vivo
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
              <div className="flex-1 p-4 lg:p-6">
                <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    { label: 'Campañas', val: '24', color: 'bg-blue-500/20' },
                    { label: 'Espacios', val: '340', color: 'bg-emerald-500/20' },
                    { label: 'Propuestas', val: '12', color: 'bg-purple-500/20' },
                    { label: 'Revenue', val: '$284K', color: 'bg-amber-500/20' },
                  ].map(c => (
                    <div key={c.label} className={`rounded-lg p-3 ${c.color} border border-surface-700`}>
                      <div className="h-2 w-12 rounded bg-slate-600 mb-2" />
                      <div className="h-5 w-10 rounded bg-slate-500" />
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-surface-700 p-3">
                  <div className="mb-3 h-3 w-24 rounded bg-surface-700" />
                  <div className="space-y-2">
                    {[80, 60, 90, 45, 70].map((w, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-2 w-20 rounded bg-surface-700" />
                        <div className="h-2 flex-1 rounded bg-surface-700">
                          <div className="h-2 rounded bg-brand/50" style={{ width: `${w}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
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
      <section id="precios" className="px-4 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-white lg:text-4xl">Precios claros y justos</h2>
            <p className="mt-4 text-slate-400">Comienza gratis, escala cuando lo necesites.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {PLANS.map(({ name, price, desc, features, highlighted }) => (
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
                  <div className="mt-4">
                    <span className="text-4xl font-extrabold text-white">{price}</span>
                    {price !== 'Custom' && <span className="text-slate-500">/mes</span>}
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
                  to="/register"
                  className={highlighted ? 'btn-primary w-full justify-center' : 'btn-secondary w-full justify-center'}
                >
                  {price === 'Custom' ? 'Contactar ventas' : 'Comenzar gratis'}
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
              Transforma tu agencia hoy mismo
            </h2>
            <p className="mt-4 text-slate-400">
              Únete a más de 200 agencias que ya gestionan su operación OOH con nosotros.
            </p>
            <Link to="/register" className="btn-primary mt-8 inline-flex text-base px-8 py-3">
              Crear cuenta gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
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
