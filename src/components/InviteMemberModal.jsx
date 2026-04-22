import { useState } from 'react'
import { X, UserPlus, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Button from './ui/Button'
import Input from './ui/Input'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMPTY = { email: '', role: 'salesperson', full_name: '' }

export default function InviteMemberModal({ open, onClose, onSuccess }) {
  const [form, setForm]             = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [successEmail, setSuccess]  = useState(null)

  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const email = form.email.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      setError('Email inválido.')
      return
    }

    setSubmitting(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('invite-member', {
        body: {
          email,
          role: form.role,
          full_name: form.full_name.trim() || null,
        },
      })

      if (fnErr) {
        setError(fnErr.message || 'No se pudo enviar la invitación.')
      } else if (data?.error) {
        setError(data.error)
      } else if (data?.warning) {
        setError(`${data.warning} (${data.email_error ?? ''})`)
      } else {
        setSuccess(email)
      }
    } catch (err) {
      setError(err?.message ?? 'Error inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setForm(EMPTY)
    setError('')
    setSuccess(null)
  }

  function handleClose() {
    reset()
    onClose?.()
  }

  function handleInviteAnother() {
    reset()
  }

  function handleDone() {
    onSuccess?.()
    reset()
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 bg-surface-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="font-semibold text-white text-sm">
            {successEmail ? 'Invitación enviada' : 'Invitar miembro'}
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {successEmail ? (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-teal-500/10 p-3">
                  <CheckCircle className="h-10 w-10 text-teal-400" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Invitación enviada a</p>
                <p className="text-brand font-semibold mt-1 break-all">{successEmail}</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Le llegará un email con el link para aceptar la invitación y crear su contraseña.
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={handleInviteAnother} className="flex-1">
                  Invitar otro
                </Button>
                <Button onClick={handleDone} className="flex-1">
                  Listo
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                required
                autoFocus
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="maria@empresa.com"
              />

              <Input
                label="Nombre (opcional)"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="María García"
              />

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Rol
                </label>
                <select
                  className="input-field w-full"
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                >
                  <option value="salesperson">Vendedor</option>
                  <option value="manager">Manager</option>
                </select>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Managers pueden invitar a otros miembros. Vendedores solo ven propuestas y campañas.
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
                  {error}
                </div>
              )}

              <Button type="submit" loading={submitting} className="w-full">
                <UserPlus className="h-4 w-4 mr-1.5" />
                Enviar invitación
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
