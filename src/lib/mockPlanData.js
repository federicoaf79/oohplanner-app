// Datos mock para probar el UI sin Edge Function desplegada.
// Activar con: VITE_USE_MOCK_AI=true en .env.local

export const MOCK_SITES_A = [
  { site_id: 'mock-1', name: 'Digital 9 de Julio & Corrientes', format: 'digital',
    address: 'Av. 9 de Julio 1800', city: 'Buenos Aires (CABA)',
    latitude: -34.6037, longitude: -58.3816,
    rate: 120000, dailyTraffic: 95000, impactsPerMonth: 285000,
    audienceMatchScore: 91, justification: 'Máxima visibilidad en el eje central de la ciudad.' },
  { site_id: 'mock-2', name: 'Espectacular Autopista 25 de Mayo km 3', format: 'billboard',
    address: 'Autopista 25 de Mayo km 3', city: 'Buenos Aires (CABA)',
    latitude: -34.6256, longitude: -58.4012,
    rate: 85000, dailyTraffic: 180000, impactsPerMonth: 540000,
    audienceMatchScore: 85, justification: 'Alto tráfico vehicular de perfil ABC1/C2.' },
  { site_id: 'mock-3', name: 'Digital Santa Fe & Palermo', format: 'digital',
    address: 'Av. Santa Fe 3400', city: 'Buenos Aires (CABA)',
    latitude: -34.5858, longitude: -58.4120,
    rate: 88000, dailyTraffic: 68000, impactsPerMonth: 204000,
    audienceMatchScore: 88, justification: 'Zona premium de alto poder adquisitivo en Palermo.' },
  { site_id: 'mock-4', name: 'Espectacular Libertador & Pampa', format: 'billboard',
    address: 'Av. del Libertador 6200', city: 'Buenos Aires (CABA)',
    latitude: -34.5478, longitude: -58.4580,
    rate: 75000, dailyTraffic: 140000, impactsPerMonth: 420000,
    audienceMatchScore: 83, justification: 'Corredor norte de alto nivel socioeconómico.' },
  { site_id: 'mock-5', name: 'Digital Córdoba & Florida', format: 'digital',
    address: 'Av. Córdoba 800', city: 'Buenos Aires (CABA)',
    latitude: -34.5989, longitude: -58.3754,
    rate: 105000, dailyTraffic: 80000, impactsPerMonth: 240000,
    audienceMatchScore: 90, justification: 'Centro comercial de alta densidad peatonal.' },
]

export const MOCK_SITES_B = [
  { site_id: 'mock-2', name: 'Espectacular Autopista 25 de Mayo km 3', format: 'billboard',
    address: 'Autopista 25 de Mayo km 3', city: 'Buenos Aires (CABA)',
    latitude: -34.6256, longitude: -58.4012,
    rate: 85000, dailyTraffic: 180000, impactsPerMonth: 540000,
    audienceMatchScore: 85, justification: 'Mayor volumen de impactos diarios de toda la selección.' },
  { site_id: 'mock-1', name: 'Digital 9 de Julio & Corrientes', format: 'digital',
    address: 'Av. 9 de Julio 1800', city: 'Buenos Aires (CABA)',
    latitude: -34.6037, longitude: -58.3816,
    rate: 120000, dailyTraffic: 95000, impactsPerMonth: 285000,
    audienceMatchScore: 91, justification: 'CPM eficiente para audiencia urbana premium.' },
  { site_id: 'mock-6', name: 'Medianera Callao & Santa Fe', format: 'ambient',
    address: 'Av. Callao 1700', city: 'Buenos Aires (CABA)',
    latitude: -34.5950, longitude: -58.3940,
    rate: 32000, dailyTraffic: 42000, impactsPerMonth: 126000,
    audienceMatchScore: 78, justification: 'Bajo costo que maximiza el alcance del presupuesto restante.' },
  { site_id: 'mock-7', name: 'Medianera Las Heras & Austria', format: 'ambient',
    address: 'Av. Las Heras 2100', city: 'Buenos Aires (CABA)',
    latitude: -34.5817, longitude: -58.3940,
    rate: 28000, dailyTraffic: 38000, impactsPerMonth: 114000,
    audienceMatchScore: 82, justification: 'Recoleta, zona de alta concentración del NSE objetivo.' },
]

export const MOCK_RESPONSE = {
  optionA: {
    label: 'Máximo Alcance',
    rationale: 'Cobertura distribuida en 5 ubicaciones clave del eje norte-sur de CABA, combinando digital y espectacular para maximizar la frecuencia de impacto. La selección garantiza presencia en los principales corredores de tránsito vehicular y peatonal.',
    sites: MOCK_SITES_A,
    metrics: {
      totalRate: 473000,
      budgetAvailable: 500000,
      budgetUsedPct: 94.6,
      totalImpactsPerMonth: 1689000,
      estimatedReach: 320000,
      estimatedCPM: 280,
      formatMix: { billboard: 2, digital: 3, ambient: 0 },
    },
  },
  optionB: {
    label: 'Máximo Impacto',
    rationale: 'Concentración en los 4 soportes de mayor daily_traffic disponibles, priorizando el impacto bruto sobre la dispersión geográfica. El ahorro presupuestario vs Opción A permite una extensión de campaña o producción de piezas adicionales.',
    sites: MOCK_SITES_B,
    metrics: {
      totalRate: 265000,
      budgetAvailable: 500000,
      budgetUsedPct: 53,
      totalImpactsPerMonth: 1065000,
      estimatedReach: 210000,
      estimatedCPM: 249,
      formatMix: { billboard: 1, digital: 1, ambient: 2 },
    },
  },
}

export function mockDelay(ms = 2800) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
