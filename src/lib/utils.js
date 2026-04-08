import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// ARS: $ 1.000.000 — prefijar $ manualmente evita que Intl produzca
// "US$ 120.000" o "ARS 120.000" en browsers con datos de locale incompletos.
const _arsFmt = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatCurrency(amount) {
  if (amount == null) return '—'
  const n = Number(amount)
  if (isNaN(n)) return '—'
  return `$ ${_arsFmt.format(Math.round(n))}`
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateStr))
}

export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
