import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Mail, MessageSquare, MapPin, Send, Check, AlertCircle } from 'lucide-react'

const SUBJECTS = [
  'Quiero ver una demo',
  'Tengo preguntas sobre el producto',
  'Quiero conocer los planes y precios',
  'Soporte técnico',
  'Otro',
]

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', company: '', subject: SUBJECTS[0], message: '' })
  const [status, setStatus] = useState('idle') // idle | sending | done | error

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) return
    setStatus('sending')
    try {
      // Enviar via mailto como fallback confiable (sin servidor necesario)
      const body = encodeURIComponent(
        `Nombre: ${form.name}\nEmpresa: ${form.company}\nEmail: ${form.email}\nAsunto: ${form.subject}\n\n${form.message}`
      )
      window.location.href = `mailto:hola@oohplanner.net?subject=${encodeURIComponent(`[OOH Planner] ${form.subject} — ${form.name}`)}&body=${body}`
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 text-slate-100">

      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-surface-700/50 bg-surface-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
          <Link to="/">
            <img src="/logo2.png" alt="OOH Planner" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/about" className="text-sm text-slate-400 hover:text-white transition-colors">Nosotros</Link>
            <Link to="/contact" className="text-sm font-medium text-brand">Contacto</Link>
            <Link to="/login" className="btn-secondary text-sm px-4 py-2">Ingresar</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-12 px-4 lg:px-8 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-sm text-brand">
            <MessageSquare className="h-3.5 w-3.5" />
            Hablemos
          </div>
          <h1 className="text-4xl font-extrabold text-white lg:text-5xl">
            Contacto
          </h1>
          <p className="mt-4 text-slate-400 text-lg">
            Contanos tu operación y te mostramos cómo OOH Planner se adapta a ella.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-4 pb-20 lg:px-8">
        <div className="mx-auto max-w-5xl grid gap-12 lg:grid-cols-5">

          {/* Info lateral */}
          <div className="lg:col-span-2 space-y-8">

            <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-6 space-y-5">
              <h3 className="text-sm font-semibold text-white">Formas de contacto</h3>

              <a href="mailto:hola@oohplanner.net"
                className="flex items-center gap-3 text-sm text-slate-400 hover:text-brand transition-colors group">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 group-hover:bg-brand/20 transition-colors">
                  <Mail className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-white">hola@oohplanner.net</p>
                </div>
              </a>

              <a href="https://wa.me/5491100000000"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-slate-400 hover:text-brand transition-colors group">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 group-hover:bg-brand/20 transition-colors">
                  <MessageSquare className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">WhatsApp</p>
                  <p className="text-white">Escribinos por WhatsApp</p>
                </div>
              </a>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-700">
                  <MapPin className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ubicación</p>
                  <p className="text-white text-sm">Buenos Aires, Argentina</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-6 space-y-3">
              <h3 className="text-sm font-semibold text-white">¿Qué pasa después?</h3>
              {[
                'Respondemos en menos de 24 horas hábiles',
                'Te agendamos una demo personalizada',
                'Analizamos tu operación juntos',
                'Si encaja, arrancás con un período de prueba',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-slate-400">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-brand">
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
          </div>

          {/* Formulario */}
          <div className="lg:col-span-3">
            {status === 'done' ? (
              <div className="rounded-2xl border border-surface-700 bg-surface-800/50 p-10 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/20">
                    <Check className="h-8 w-8 text-brand" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white">¡Mensaje enviado!</h3>
                <p className="text-slate-400">Se abrió tu cliente de correo con el mensaje listo. Si no abrió automáticamente, escribinos directamente a <a href="mailto:hola@oohplanner.net" className="text-brand hover:underline">hola@oohplanner.net</a>.</p>
                <button onClick={() => setStatus('idle')} className="btn-secondary mt-4">
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="rounded-2xl border border-surface-700 bg-surface-800/50 p-8 space-y-5">
                <h3 className="text-lg font-semibold text-white">Envianos un mensaje</h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Nombre *</label>
                    <input
                      className="input-field"
                      placeholder="Tu nombre"
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Email *</label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="tu@empresa.com"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Empresa / operadora</label>
                  <input
                    className="input-field"
                    placeholder="Nombre de tu empresa u operación OOH"
                    value={form.company}
                    onChange={e => set('company', e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Asunto</label>
                  <select
                    className="input-field appearance-none"
                    value={form.subject}
                    onChange={e => set('subject', e.target.value)}
                  >
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Mensaje *</label>
                  <textarea
                    className="input-field resize-none"
                    rows={5}
                    placeholder="Contanos sobre tu operación: cuántos carteles tenés, qué formatos, en qué ciudades, qué querés mejorar..."
                    value={form.message}
                    onChange={e => set('message', e.target.value)}
                    required
                  />
                </div>

                {status === 'error' && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Hubo un error. Escribinos directamente a hola@oohplanner.net
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="btn-primary w-full py-3 text-base"
                >
                  {status === 'sending'
                    ? 'Enviando...'
                    : <><Send className="h-4 w-4" /> Enviar mensaje</>
                  }
                </button>

                <p className="text-xs text-slate-600 text-center">
                  Al enviar aceptás que nos contactemos con vos sobre OOH Planner.
                </p>
              </form>
            )}
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
