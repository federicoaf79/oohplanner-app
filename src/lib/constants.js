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
  HOME:       '/',
  LOGIN:      '/login',
  REGISTER:   '/register',
  APP:        '/app',
  DASHBOARD:  '/app',
  CAMPAIGNS:  '/app/campaigns',
  INVENTORY:  '/app/inventory',
  PROPOSALS:  '/app/proposals',
  REPORTS:    '/app/reports',
  TEAM:       '/app/team',
  SETTINGS:   '/app/settings',
}
