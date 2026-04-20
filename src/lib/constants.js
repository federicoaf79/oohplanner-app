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
  draft:            'Borrador',
  sent:             'Enviada',
  accepted:         'Aceptada',
  rejected:         'Rechazada',
  pending_approval: 'Esperando aprobación',
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
    color: '#14b8a6',
    colorClass: 'text-teal-400',
    bgClass:    'bg-teal-500/10',
    borderClass: 'border-teal-500/50',
  },
  {
    id: 'poster',
    label: 'Afiche papel',
    desc: 'Afiches de papel en soportes fijos, alta densidad urbana',
    icon: '📋',
    color: '#eab308',
    colorClass: 'text-yellow-400',
    bgClass:    'bg-yellow-500/10',
    borderClass: 'border-yellow-500/50',
  },
  {
    id: 'urban_furniture',
    label: 'Mob. urbano',
    desc: 'Soportes en mobiliario urbano (refugios, columnas, kioscos)',
    icon: '🪧',
    color: '#8b5cf6',
    colorClass: 'text-violet-400',
    bgClass:    'bg-violet-500/10',
    borderClass: 'border-violet-500/50',
  },
  {
    id: 'urban_furniture_digital',
    label: 'Mob. digital',
    desc: 'Pantallas digitales en mobiliario urbano con alta frecuencia',
    icon: '🖥️',
    color: '#06b6d4',
    colorClass: 'text-cyan-400',
    bgClass:    'bg-cyan-500/10',
    borderClass: 'border-cyan-500/50',
  },
  {
    id: 'mobile_screen',
    label: 'Pantalla móvil',
    desc: 'Pantalla LED sobre vehículo, recorrido programado por zonas',
    icon: '🚌',
    color: '#ec4899',
    colorClass: 'text-pink-400',
    bgClass:    'bg-pink-500/10',
    borderClass: 'border-pink-500/50',
  },
]

export const FORMAT_MAP = {
  billboard:               { label: 'Espectacular',        color: '#f97316' },
  digital:                 { label: 'Digital LED',         color: '#3b82f6' },
  ambient:                 { label: 'Medianera',           color: '#14b8a6' },
  poster:                  { label: 'Afiche papel',        color: '#eab308' },
  urban_furniture:         { label: 'Mob. urbano',         color: '#8b5cf6' },
  urban_furniture_digital: { label: 'Mob. digital',        color: '#06b6d4' },
  mobile_screen:           { label: 'Pantalla móvil',      color: '#ec4899' },
}

export const CAMPAIGN_OBJECTIVES = [
  {
    value: 'awareness',
    label: 'Reconocimiento de marca',
    icon: '📣',
    desc: 'Aumentar visibilidad y recordación de marca en el target',
  },
  {
    value: 'traffic',
    label: 'Activación',
    icon: '🚦',
    desc: 'Activar al público con QR, promociones o llamadas a la acción directa',
    badge: 'En desarrollo',
  },
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

export const WORKFLOW_STATUSES = [
  { id: 'approved',     label: 'Aprobada',    color: '#14b8a6' },
  { id: 'printing',     label: 'Impresión',   color: '#f59e0b' },
  { id: 'colocation', label: 'Colocación', color: '#3b82f6' },
  { id: 'active',       label: 'Activa',      color: '#14b8a6' },
  { id: 'withdraw',     label: 'Retirar',     color: '#f97316' },
  { id: 'renew',        label: 'Renovar',     color: '#a855f7' },
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

// Provincias y ciudades de Argentina para el planificador
export const PROVINCES_CITIES = [
  {
    id: 'CABA',
    name: 'CABA',
    cities: ['Buenos Aires (CABA)', 'Palermo', 'Belgrano', 'Recoleta', 'San Telmo', 'Caballito', 'Flores', 'Villa Crespo', 'Almagro', 'Núñez', 'Barracas', 'Boedo'],
  },
  {
    id: 'Buenos Aires',
    name: 'Buenos Aires (Prov.)',
    cities: ['La Plata', 'Mar del Plata', 'Quilmes', 'Lomas de Zamora', 'Lanús', 'Morón', 'Bahía Blanca', 'San Isidro', 'Tigre', 'Vicente López', 'Ramos Mejía', 'San Miguel'],
  },
  {
    id: 'Córdoba',
    name: 'Córdoba',
    cities: ['Córdoba', 'Villa Carlos Paz', 'Río Cuarto', 'Villa María', 'Alta Gracia', 'Bell Ville'],
  },
  {
    id: 'Santa Fe',
    name: 'Santa Fe',
    cities: ['Rosario', 'Santa Fe', 'Rafaela', 'Venado Tuerto', 'Reconquista'],
  },
  {
    id: 'Mendoza',
    name: 'Mendoza',
    cities: ['Mendoza', 'San Rafael', 'Godoy Cruz', 'Las Heras', 'Maipú'],
  },
  {
    id: 'Tucumán',
    name: 'Tucumán',
    cities: ['San Miguel de Tucumán', 'Yerba Buena', 'Tafí Viejo', 'Banda del Río Salí'],
  },
  {
    id: 'Neuquén',
    name: 'Neuquén',
    cities: ['Neuquén', 'San Martín de los Andes', 'Zapala', 'Cipolletti'],
  },
  {
    id: 'Salta',
    name: 'Salta',
    cities: ['Salta', 'Tartagal', 'Orán', 'Cafayate'],
  },
  {
    id: 'Entre Ríos',
    name: 'Entre Ríos',
    cities: ['Paraná', 'Concordia', 'Gualeguaychú', 'Concepción del Uruguay'],
  },
  {
    id: 'Chaco',
    name: 'Chaco',
    cities: ['Resistencia', 'Presidencia R. S. Peña', 'Barranqueras'],
  },
  {
    id: 'Corrientes',
    name: 'Corrientes',
    cities: ['Corrientes', 'Goya', 'Mercedes', 'Paso de los Libres'],
  },
  {
    id: 'Misiones',
    name: 'Misiones',
    cities: ['Posadas', 'Oberá', 'Puerto Iguazú', 'Eldorado'],
  },
  {
    id: 'Río Negro',
    name: 'Río Negro',
    cities: ['Bariloche', 'Viedma', 'Cipolletti', 'General Roca'],
  },
  {
    id: 'Chubut',
    name: 'Chubut',
    cities: ['Comodoro Rivadavia', 'Trelew', 'Puerto Madryn', 'Rawson'],
  },
  {
    id: 'Jujuy',
    name: 'Jujuy',
    cities: ['San Salvador de Jujuy', 'Palpalá', 'San Pedro'],
  },
  {
    id: 'San Juan',
    name: 'San Juan',
    cities: ['San Juan', 'Rivadavia', 'Caucete'],
  },
  {
    id: 'San Luis',
    name: 'San Luis',
    cities: ['San Luis', 'Villa Mercedes', 'Merlo'],
  },
  {
    id: 'La Pampa',
    name: 'La Pampa',
    cities: ['Santa Rosa', 'General Pico'],
  },
]
