// Datos mock para probar el UI sin Edge Function desplegada.
// Activar con: VITE_USE_MOCK_AI=true en .env.local

export const MOCK_SITES_A = [
  {
    id: 'mock-1', name: 'Digital 9 de Julio & Corrientes', format: 'digital',
    address: 'Av. 9 de Julio 1800', city: 'Buenos Aires (CABA)', province: 'CABA',
    latitude: -34.6037, longitude: -58.3816,
    list_price: 120000, client_price: 108000,
    monthly_impacts: 285000, audience_score: 91, is_mandatory: false,
    justification: 'Máxima visibilidad en el eje central de la ciudad.',
  },
  {
    id: 'mock-2', name: 'Espectacular Autopista 25 de Mayo km 3', format: 'billboard',
    address: 'Autopista 25 de Mayo km 3', city: 'Buenos Aires (CABA)', province: 'CABA',
    latitude: -34.6256, longitude: -58.4012,
    list_price: 85000, client_price: 76500,
    monthly_impacts: 540000, audience_score: 85, is_mandatory: false,
    justification: 'Alto tráfico vehicular de perfil ABC1/C2.',
  },
  {
    id: 'mock-3', name: 'Digital Santa Fe & Palermo', format: 'digital',
    address: 'Av. Santa Fe 3400', city: 'Buenos Aires (CABA)', province: 'CABA',
    latitude: -34.5858, longitude: -58.4120,
    list_price: 88000, client_price: 79200,
    monthly_impacts: 204000, audience_score: 88, is_mandatory: false,
    justification: 'Zona premium de alto poder adquisitivo en Palermo.',
  },
  {
    id: 'mock-4', name: 'Espectacular Libertador & Pampa', format: 'billboard',
    address: 'Av. del Libertador 6200', city: 'Buenos Aires (CABA)', province: 'CABA',
    latitude: -34.5478, longitude: -58.4580,
    list_price: 75000, client_price: 67500,
    monthly_impacts: 420000, audience_score: 83, is_mandatory: false,
    justification: 'Corredor norte de alto nivel socioeconómico.',
  },
  {
    id: 'mock-5', name: 'Digital Córdoba & Florida', format: 'digital',
    address: 'Av. Córdoba 800', city: 'Buenos Aires (CABA)', province: 'CABA',
    latitude: -34.5989, longitude: -58.3754,
    list_price: 105000, client_price: 94500,
    monthly_impacts: 240000, audience_score: 90, is_mandatory: false,
    justification: 'Centro comercial de alta densidad peatonal.',
  },
]

export const MOCK_SITES_B = [
  {
    id: 'mock-2', name: 'Espectacular Autopista 25 de Mayo km 3', format: 'billboard',
    address: 'Autopista 25 de Mayo km 3', city: 'Buenos Aires (CABA)', province: 'CABA',
    latitude: -34.6256, longitude: -58.4012,
    list_price: 85000, client_price: 76500,
    monthly_impacts: 540000, audience_score: 85, is_mandatory: false,
    justification: 'Mayor volumen de impactos diarios de toda la selección.',
  },
  {
    id: 'mock-1', name: 'Digital 9 de Julio & Corrientes', format: 'digital',
    address: 'Av. 9 de Julio 1800', city: 'Buenos Aires (CABA)', province: 'CABA',
    latitude: -34.6037, longitude: -58.3816,
    list_price: 120000, client_price: 108000,
    monthly_impacts: 285000, audience_score: 91, is_mandatory: false,
    justification: 'CPM eficiente para audiencia urbana premium.',
  },
  {
    id: 'mock-6', name: 'Medianera Callao & Santa Fe', format: 'ambient',
    address: 'Av. Callao 1700', city: 'Buenos Aires (CABA)', province: 'CABA',
    latitude: -34.5950, longitude: -58.3940,
    list_price: 32000, client_price: 28800,
    monthly_impacts: 126000, audience_score: 78, is_mandatory: false,
    justification: 'Bajo costo que maximiza el alcance del presupuesto restante.',
  },
  {
    id: 'mock-7', name: 'Medianera Las Heras & Austria', format: 'ambient',
    address: 'Av. Las Heras 2100', city: 'Buenos Aires (CABA)', province: 'CABA',
    latitude: -34.5817, longitude: -58.3940,
    list_price: 28000, client_price: 25200,
    monthly_impacts: 114000, audience_score: 82, is_mandatory: false,
    justification: 'Recoleta, zona de alta concentración del NSE objetivo.',
  },
]

export const MOCK_RESPONSE = {
  audience_mode: 'full',
  audience_note: null,
  optionA: {
    title: 'Máximo Alcance',
    rationale: 'Cobertura distribuida en 5 ubicaciones clave del eje norte-sur de CABA, combinando digital y espectacular para maximizar la frecuencia de impacto. La selección garantiza presencia en los principales corredores de tránsito vehicular y peatonal.',
    sites: MOCK_SITES_A,
    total_list_price:  473000,
    total_client_price: 425700,
    discount_amount:   47300,
    budget_remaining:  74300,
    next_billboard_gap: 0,
    total_impacts:     1689000,
    estimated_reach:   320000,
    cpm:               280,
    format_mix:        { billboard: 2, digital: 3, ambient: 0 },
  },
  optionB: {
    title: 'Máximo Impacto',
    rationale: 'Concentración en los 4 soportes de mayor tráfico disponibles, priorizando el impacto bruto sobre la dispersión geográfica. El ahorro presupuestario vs Opción A permite una extensión de campaña o producción de piezas adicionales.',
    sites: MOCK_SITES_B,
    total_list_price:  265000,
    total_client_price: 238500,
    discount_amount:   26500,
    budget_remaining:  261500,
    next_billboard_gap: 0,
    total_impacts:     1065000,
    estimated_reach:   210000,
    cpm:               249,
    format_mix:        { billboard: 1, digital: 1, ambient: 2 },
  },
}

export function mockDelay(ms = 2800) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
