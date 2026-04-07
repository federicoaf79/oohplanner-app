export const ROLES = {
  OWNER:       'owner',
  MANAGER:     'manager',
  SALESPERSON: 'salesperson',
}

export const ROLE_LABELS = {
  owner:       'Owner',
  manager:     'Manager',
  salesperson: 'Vendedor',
}

export const CAMPAIGN_STATUS = {
  DRAFT:     'draft',
  ACTIVE:    'active',
  PAUSED:    'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

export const CAMPAIGN_STATUS_LABELS = {
  draft:     'Borrador',
  active:    'Activa',
  paused:    'Pausada',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

export const PROPOSAL_STATUS_LABELS = {
  draft:    'Borrador',
  sent:     'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
}

export const ROUTES = {
  HOME:          '/',
  LOGIN:         '/login',
  REGISTER:      '/register',
  APP:           '/app',
  DASHBOARD:     '/app',
  CAMPAIGNS:     '/app/campaigns',
  INVENTORY:     '/app/inventory',
  PROPOSALS:     '/app/proposals',
  PROPOSALS_NEW: '/app/proposals/new',
  REPORTS:       '/app/reports',
  TEAM:          '/app/team',
  SETTINGS:      '/app/settings',
}

// ── Planificador IA ──────────────────────────────────────────

export const OOH_FORMATS = [
  {
    id: 'billboard',
    label: 'Espectacular',
    desc: 'Carteles grandes iluminados en rutas y avenidas principales',
    icon: '🏙️',
    color: '#f97316',
    colorClass: 'text-orange-400',
    bgClass:    'bg-orange-500/10',
    borderClass: 'border-orange-500/50',
  },
  {
    id: 'digital',
    label: 'Digital LED',
    desc: 'Pantallas electrónicas con rotación de spots en tiempo real',
    icon: '📺',
    color: '#3b82f6',
    colorClass: 'text-blue-400',
    bgClass:    'bg-blue-500/10',
    borderClass: 'border-blue-500/50',
  },
  {
    id: 'ambient',
    label: 'Medianera',
    desc: 'Carteles pintados o impresos en paredes de edificios',
    icon: '🏢',
    color: '#22c55e',
    colorClass: 'text-green-400',
    bgClass:    'bg-green-500/10',
    borderClass: 'border-green-500/50',
  },
]

export const FORMAT_MAP = {
  billboard: { label: 'Espectacular', color: '#f97316' },
  digital:   { label: 'Digital LED',  color: '#3b82f6' },
  ambient:   { label: 'Medianera',    color: '#22c55e' },
}

export const CAMPAIGN_OBJECTIVES = [
  { value: 'awareness',   label: 'Reconocimiento de marca', icon: '📣',
    desc: 'Aumentar visibilidad y recordación de marca' },
  { value: 'traffic',     label: 'Generación de tráfico',   icon: '🚦',
    desc: 'Dirigir público a un punto de venta o sitio web' },
  { value: 'conversion',  label: 'Conversión / Ventas',     icon: '🎯',
    desc: 'Impulsar compras directas o leads calificados' },
]

export const AUDIENCE_INTERESTS = [
  { value: 'tecnologia',     label: 'Tecnología' },
  { value: 'salud',          label: 'Salud & Bienestar' },
  { value: 'retail',         label: 'Retail & Consumo' },
  { value: 'automotriz',     label: 'Automotriz' },
  { value: 'gastronomia',    label: 'Gastronomía' },
  { value: 'finanzas',       label: 'Finanzas' },
  { value: 'moda',           label: 'Moda & Estilo' },
  { value: 'entretenimiento',label: 'Entretenimiento' },
]

export const NSE_OPTIONS = [
  { value: 'ABC1', label: 'ABC1', desc: 'Alto / Medio-alto' },
  { value: 'C2',   label: 'C2',   desc: 'Medio' },
  { value: 'C3',   label: 'C3',   desc: 'Medio-bajo' },
]

export const DIGITAL_FREQUENCIES = [
  { value: 'cada_8s',   label: 'Cada 8 segundos' },
  { value: 'cada_15s',  label: 'Cada 15 segundos' },
  { value: 'indistinto',label: 'Indistinto' },
]

export const CABA_CITIES = [
  'Buenos Aires (CABA)',
  'Palermo',
  'Belgrano',
  'Caballito',
  'San Telmo',
  'Recoleta',
  'Flores',
  'Villa Crespo',
  'Almagro',
  'Núñez',
]
