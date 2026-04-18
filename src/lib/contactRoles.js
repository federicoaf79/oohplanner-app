export const CONTACT_ROLE_CATEGORIES = [
  { id: 'commercial',      label: 'Comerciales',                 color: '#3B82F6' },
  { id: 'construction',    label: 'Construcción e instalación',  color: '#8B5CF6' },
  { id: 'production',      label: 'Producción y colocación',     color: '#EC4899' },
  { id: 'maintenance',     label: 'Mantenimiento y servicios',   color: '#F59E0B' },
  { id: 'logistics',       label: 'Logística y transporte',      color: '#06B6D4' },
  { id: 'property',        label: 'Propiedad y terrenos',        color: '#14B8A6' },
  { id: 'regulatory',      label: 'Autoridades',                 color: '#64748B' },
  { id: 'finance',         label: 'Administración y finanzas',   color: '#F97316' },
  { id: 'tech',            label: 'Tecnología',                  color: '#A855F7' },
  { id: 'hr',              label: 'Personal',                    color: '#0EA5E9' },
]

export const CONTACT_ROLES = [
  // Comerciales
  { id: 'advertiser',           label: 'Anunciante',                  category: 'commercial' },
  { id: 'agency',               label: 'Agencia',                     category: 'commercial' },
  { id: 'reseller',             label: 'Comercializador',             category: 'commercial' },
  { id: 'media_group',          label: 'Multimedio',                  category: 'commercial' },
  { id: 'facilitator',          label: 'Facilitador',                 category: 'commercial' },
  { id: 'external_seller',      label: 'Vendedor externo',            category: 'commercial' },
  { id: 'supplier',             label: 'Proveedor (otros)',           category: 'commercial' },
  // Construcción
  { id: 'structure_builder',    label: 'Constructor de estructura',   category: 'construction' },
  { id: 'electrical_installer', label: 'Instalador eléctrico',        category: 'construction' },
  { id: 'lighting_installer',   label: 'Instalador de iluminación',   category: 'construction' },
  { id: 'sign_manufacturer',    label: 'Fabricante de cartelería',    category: 'construction' },
  { id: 'crane_operator',       label: 'Operador de grúa',            category: 'construction' },
  { id: 'painter',              label: 'Pintor',                      category: 'construction' },
  // Producción
  { id: 'printer',              label: 'Impresor',                    category: 'production' },
  { id: 'installer',            label: 'Colocador',                   category: 'production' },
  { id: 'graphic_designer',     label: 'Diseñador gráfico',           category: 'production' },
  { id: 'content_producer',     label: 'Productor de contenido DOOH', category: 'production' },
  // Mantenimiento
  { id: 'maintenance',          label: 'Mantenimiento',               category: 'maintenance' },
  { id: 'electrician',          label: 'Electricista',                category: 'maintenance' },
  { id: 'cleaning',             label: 'Limpieza',                    category: 'maintenance' },
  { id: 'security',             label: 'Seguridad',                   category: 'maintenance' },
  { id: 'pest_control',         label: 'Control de plagas',           category: 'maintenance' },
  { id: 'doorman',              label: 'Portero',                     category: 'maintenance' },
  { id: 'courier',              label: 'Mensajería',                  category: 'maintenance' },
  // Logística
  { id: 'freight',              label: 'Fletes y traslados',          category: 'logistics' },
  { id: 'storage',              label: 'Depósito',                    category: 'logistics' },
  // Propiedad
  { id: 'landlord',             label: 'Propietario del terreno',     category: 'property' },
  { id: 'property_manager',     label: 'Administrador de propiedad',  category: 'property' },
  { id: 'building_manager',     label: 'Administrador de edificio',   category: 'property' },
  // Autoridades
  { id: 'municipality',         label: 'Municipio',                   category: 'regulatory' },
  { id: 'provincial_authority', label: 'Ente provincial',             category: 'regulatory' },
  { id: 'national_authority',   label: 'Ente nacional',               category: 'regulatory' },
  { id: 'utility_company',      label: 'Empresa de servicios',        category: 'regulatory' },
  // Finanzas
  { id: 'accountant',           label: 'Contador',                    category: 'finance' },
  { id: 'lawyer',               label: 'Abogado',                     category: 'finance' },
  { id: 'bank',                 label: 'Banco',                       category: 'finance' },
  { id: 'insurance',            label: 'Seguro',                      category: 'finance' },
  { id: 'tax_authority',        label: 'Autoridad fiscal',            category: 'finance' },
  { id: 'collector',            label: 'Cobrador',                    category: 'finance' },
  // Tecnología
  { id: 'software_provider',    label: 'Proveedor de software',       category: 'tech' },
  { id: 'internet_provider',    label: 'Proveedor de internet',       category: 'tech' },
  { id: 'data_provider',        label: 'Proveedor de data',           category: 'tech' },
  { id: 'tech_support',         label: 'Soporte técnico',             category: 'tech' },
  // Personal
  { id: 'employee',             label: 'Empleado',                    category: 'hr' },
  { id: 'contractor',           label: 'Contratista/Monotributista',  category: 'hr' },
]

// Mapa directo id → label
export const ROLE_LABEL_MAP = Object.fromEntries(
  CONTACT_ROLES.map(r => [r.id, r.label])
)

// Mapa directo id → category
export const ROLE_CATEGORY_MAP = Object.fromEntries(
  CONTACT_ROLES.map(r => [r.id, r.category])
)

// Roles agrupados por categoría (para dropdowns con optgroup)
export const ROLES_BY_CATEGORY = CONTACT_ROLE_CATEGORIES.map(cat => ({
  ...cat,
  roles: CONTACT_ROLES.filter(r => r.category === cat.id),
}))
