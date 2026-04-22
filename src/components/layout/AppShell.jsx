import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import OnboardingTutorial from '../../features/onboarding/OnboardingTutorial'

const PAGE_TITLES = {
  '/app':                  'Dashboard',
  '/app/campaigns':        'Campañas',
  '/app/inventory':        'Inventario',
  '/app/proposals':        'Propuestas',
  '/app/proposals/new':    'Planificador IA',
  '/app/contacts':         'Contactos',
  '/app/reports':          'Reportes',
  '/app/team':             'Equipo',
  '/app/settings':         'Configuración',
  '/app/inventory-settings': 'Ajustes de inventario',
  '/app/support':          'Soporte',
  '/app/billing':          'Facturación',
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { isExpired, profile } = useAuth()

  const title = PAGE_TITLES[location.pathname] ?? 'OOH Planner'

  return (
    <div className="flex h-svh overflow-hidden bg-surface-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0 relative">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <Outlet />
          </div>
        </main>

        <MobileNav />

        {/* Onboarding tutorial — shown once for new users */}
        {profile && profile.onboarding_tutorial_seen === false && !isExpired && (
          <OnboardingTutorial />
        )}

        {/* Trial expired overlay */}
        {isExpired && <TrialExpiredOverlay />}
      </div>
    </div>
  )
}

function TrialExpiredOverlay() {
  const [dismissed, setDismissed] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const { org, profile, user } = useAuth()

  if (dismissed) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    await supabase.from('support_tickets').insert({
      org_id:        org?.id,
      created_by:    profile?.id,
      creator_name:  name || profile?.full_name || null,
      creator_email: user?.email || null,
      subject:       'Trial vencido - solicitud de extensión',
      message,
      status:        'open',
      priority:      'high',
    })
    setSubmitting(false)
    setSuccess(true)
  }

  return (
    <>
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-surface-900/90 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700 bg-surface-800 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
            <svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">
            Tu período de prueba gratuito ha vencido
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            Para continuar usando OOH Planner y acceder a todas las funcionalidades,
            contactá a nuestro equipo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary flex-1"
            >
              Contactar
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="btn-secondary flex-1"
            >
              Ver en modo lectura
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700 bg-surface-800 p-6 shadow-2xl">
            {success ? (
              <div className="text-center py-4">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10">
                  <svg className="h-6 w-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-slate-300">
                  Tu mensaje fue enviado. Te contactaremos a la brevedad.
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-base font-semibold text-white mb-4">Solicitar extensión</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Nombre</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Tu nombre"
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Mensaje</label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Contanos tu situación o consulta..."
                      rows={4}
                      required
                      className="input w-full resize-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="btn-secondary flex-1"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !message.trim()}
                      className="btn-primary flex-1 disabled:opacity-50"
                    >
                      {submitting ? 'Enviando…' : 'Enviar'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
