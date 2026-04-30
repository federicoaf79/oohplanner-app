import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Target, Zap, Shield, Users, TrendingUp } from 'lucide-react'

const VALUES = [
  {
    icon: Target,
    title: 'Pensado para el operador',
    desc: 'No somos una plataforma genérica de medios. OOH Planner nació para dueños y gestores de inventario exterior — los que tienen los carteles, los costos, los permisos y los clientes.',
    color: 'bg-brand/10 text-brand',
  },
  {
    icon: TrendingUp,
    title: 'Rentabilidad real, no estimada',
    desc: 'Cada cartel tiene su CAPEX, su OPEX y sus comisiones. El sistema calcula el margen neto real en tiempo real, sin planillas y sin suposiciones.',
    color: 'bg-amber-500/10 text-amber-400',
  },
  {
    icon: Shield,
    title: 'Datos privados por diseño',
    desc: 'Row Level Security desde el primer día. Tus carteles, contratos y clientes están aislados completamente. Ni nosotros accedemos a tus datos operativos.',
    color: 'bg-teal-500/10 text-teal-400',
  },
  {
    icon: Zap,
    title: 'IA que acelera, no reemplaza',
    desc: 'El planificador IA analiza tu inventario real y genera estrategias en segundos. Vos decidís — la IA prepara el terreno.',
    color: 'bg-purple-500/10 text-purple-400',
  },
]

const TIMELINE = [
  { year: '2024', label: 'Origen', desc: 'El proyecto nació de una necesidad real: los operadores OOH gestionaban inventario, propuestas y comisiones en Excel. Sabíamos que había una mejor forma.' },
  { year: 'Ene 2025', label: 'Primera versión', desc: 'Inventario digital, propuestas en PDF y primer mapa de ubicaciones. Beta cerrada con operadores de Buenos Aires.' },
  { year: 'Abr 2025', label: 'IA + Rentabilidad', desc: 'Planificador con IA, cálculo de margen real por cartel, y sistema de comisiones automáticas. El producto empezó a hablarle al dueño de la operación.' },
  { year: '2025–2026', label: 'En producción', desc: 'Certificaciones de instalación, CAPEX/OPEX por cartel, onboarding masivo con reconciliación inteligente. OOH Planner en uso real con operadores argentinos.' },
]

export default function About() {
  return (
    <div className="min-h-screen bg-surface-900 text-slate-100">

      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-surface-700/50 bg-surface-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
          <Link to="/">
            <img src="/logo2.png" alt="OOH Planner" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/about" className="text-sm font-medium text-brand">Nosotros</Link>
            <Link to="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">Contacto</Link>
            <Link to="/login" className="btn-secondary text-sm px-4 py-2">Ingresar</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 lg:px-8 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-sm text-brand">
            <MapPin className="h-3.5 w-3.5" />
            Buenos Aires, Argentina
          </div>
          <h1 className="text-4xl font-extrabold text-white lg:text-5xl leading-tight">
            Construido por gente que conoce<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-purple-400">
              la industria OOH
            </span>
          </h1>
          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto">
            OOH Planner nació de una convicción simple: los operadores de publicidad exterior merecen
            herramientas profesionales, no planillas de Excel.
          </p>
        </div>
      </section>

      {/* Misión */}
      <section className="px-4 py-16 lg:px-8 bg-surface-800/20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Nuestra misión</h2>
              <p className="text-slate-400 leading-relaxed mb-4">
                Digitalizar la operación de los dueños y gestores de inventario OOH en Argentina y Latinoamérica.
                Que cada cartel, cada campaña y cada peso invertido en estructura tenga visibilidad real.
              </p>
              <p className="text-slate-400 leading-relaxed mb-6">
                No somos un marketplace de medios ni una plataforma programática. Somos el sistema operativo
                de tu empresa: inventario, ventas, rentabilidad y equipo en un solo lugar.
              </p>
              <Link to="/contact" className="btn-primary inline-flex">
                Hablar con el equipo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="rounded-2xl border border-surface-700 bg-surface-800/50 p-8 space-y-4">
              {[
                { label: 'Formatos soportados', value: '6+', sub: 'Espectaculares, medianeras, digital LED, afiches, mobiliario y más' },
                { label: 'Módulos activos', value: '8', sub: 'Inventario, propuestas, campañas, reportes, comisiones, certificaciones, contactos, equipo' },
                { label: 'País de origen', value: '🇦🇷', sub: 'Diseñado para la realidad del mercado argentino' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="flex items-start gap-4 pb-4 border-b border-surface-700 last:border-0 last:pb-0">
                  <span className="text-3xl font-extrabold text-brand min-w-[3rem]">{value}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Cómo pensamos el producto</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {VALUES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="rounded-xl border border-surface-700 bg-surface-800/50 p-6">
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="px-4 py-16 lg:px-8 bg-surface-800/20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-white text-center mb-12">Cómo llegamos hasta acá</h2>
          <div className="relative">
            <div className="absolute left-16 top-0 bottom-0 w-px bg-surface-700" />
            <div className="space-y-10">
              {TIMELINE.map(({ year, label, desc }) => (
                <div key={year} className="flex gap-6 items-start">
                  <div className="w-28 shrink-0 text-right">
                    <span className="text-xs font-semibold text-brand">{year}</span>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full bg-brand border-2 border-surface-900" />
                    <p className="text-sm font-semibold text-white mb-1">{label}</p>
                    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rounded-2xl border border-brand/20 bg-brand/5 p-10">
            <h2 className="text-2xl font-bold text-white">¿Querés ver OOH Planner en acción?</h2>
            <p className="mt-3 text-slate-400">Hablemos. Te mostramos cómo se adapta a tu operación.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/contact" className="btn-primary text-base px-8 py-3">
                Contactanos <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/register" className="btn-secondary text-base px-8 py-3">
                Crear cuenta gratis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-700 px-4 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <img src="/logo2.png" alt="OOH Planner" className="h-16 w-auto" />
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} OOH Planner. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
