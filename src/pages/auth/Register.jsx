import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff, Building2, User, Mail, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    fullName: '', orgName: '', email: '', password: '', confirmPassword: ''
  })
  const [errors, setErrors]   = useState({})
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [success, setSuccess] = useState(false)

  function validate() {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Nombre requerido'
    if (!form.orgName.trim())  e.orgName  = 'Nombre de empresa requerido'
    if (!form.email.trim())    e.email    = 'Email requerido'
    if (form.password.length < 8) e.password = 'Mínimo 8 caracteres'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setError('')
    setLoading(true)
    const { error } = await signUp({
      email: form.email,
      password: form.password,
      fullName: form.fullName,
      orgName: form.orgName,
    })
    setLoading(false)
    if (error) return setError(error.message)
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-surface-900 px-4">
        <div className="w-full max-w-md text-center animate-slide-up">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/20">
              <svg className="h-8 w-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">¡Cuenta creada!</h2>
          <p className="mt-2 text-slate-400">
            Revisa tu correo <span className="text-white font-medium">{form.email}</span> y confirma tu cuenta para continuar.
          </p>
          <Link to="/login" className="mt-6 inline-block btn-primary">
            Ir al login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface-900 px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand shadow-lg shadow-brand/30">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Crea tu empresa</h1>
            <p className="mt-1 text-sm text-slate-500">14 días gratis, sin tarjeta de crédito</p>
          </div>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Tu nombre completo"
              type="text"
              placeholder="Ana García"
              value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              error={errors.fullName}
            />
            <Input
              label="Nombre de la empresa"
              type="text"
              placeholder="Medios Externos SA"
              value={form.orgName}
              onChange={e => setForm(f => ({ ...f, orgName: e.target.value }))}
              error={errors.orgName}
            />
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="ana@empresa.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              error={errors.email}
              autoComplete="email"
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Contraseña</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className={`input-field pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
            </div>

            <Input
              label="Confirmar contraseña"
              type="password"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              Crear cuenta gratis
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-brand hover:text-brand-light">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
