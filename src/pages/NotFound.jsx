import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface-900 text-center px-4">
      <p className="text-7xl font-extrabold text-brand">404</p>
      <h1 className="mt-4 text-2xl font-bold text-white">Página no encontrada</h1>
      <p className="mt-2 text-slate-500">La página que buscas no existe o fue movida.</p>
      <div className="mt-8 flex gap-3">
        <Link to="/" className="btn-secondary">Ir al inicio</Link>
        <Link to="/app" className="btn-primary">Ir a la plataforma</Link>
      </div>
    </div>
  )
}
