// Edge Function: calculate-audience-reach
// Path: supabase/functions/calculate-audience-reach/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AudienceFilters {
  age_min?: number
  age_max?: number
  gender?: string
  nse?: string[]
  interests?: string[]
}

interface CalculateRequest {
  inventory_ids: string[]
  filters?: AudienceFilters
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { inventory_ids, filters = {} }: CalculateRequest = await req.json()

    if (!inventory_ids || inventory_ids.length === 0) {
      throw new Error('inventory_ids is required')
    }

    // Obtener carteles con sus perfiles de audiencia
    const { data: billboards, error: billboardsError } = await supabaseClient
      .from('inventory')
      .select('id, name, zone_name, format, estimated_daily_reach, visibility_score, audience_profile')
      .in('id', inventory_ids)
      .not('audience_profile', 'is', null)

    if (billboardsError) {
      throw billboardsError
    }

    if (!billboards || billboards.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No billboards found with audience data',
          aggregate: { total_daily_reach: 0, total_weekly_reach: 0 },
          by_billboard: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Aplicar filtros y calcular alcance por cartel
    const results = billboards.map(billboard => {
      const profile = billboard.audience_profile
      let filteredReach = billboard.estimated_daily_reach

      // Aplicar filtro de edad
      if (filters.age_min !== undefined && filters.age_max !== undefined) {
        const ageFactor = calculateAgeFactor(
          profile.demographic_breakdown?.age || {},
          filters.age_min,
          filters.age_max
        )
        filteredReach *= ageFactor
      }

      // Aplicar filtro de género
      if (filters.gender && filters.gender !== 'Todos') {
        const genderFactor = filters.gender === 'Hombres'
          ? (profile.demographic_breakdown?.gender?.male || 50) / 100
          : (profile.demographic_breakdown?.gender?.female || 50) / 100
        filteredReach *= genderFactor
      }

      // Aplicar filtro de NSE
      if (filters.nse && filters.nse.length > 0) {
        const nseFactor = calculateNSEFactor(
          profile.demographic_breakdown?.nse || {},
          filters.nse
        )
        filteredReach *= nseFactor
      }

      // Aplicar filtro de intereses
      if (filters.interests && filters.interests.length > 0) {
        const interestFactor = calculateInterestFactor(
          profile.interest_scores || {},
          filters.interests
        )
        filteredReach *= interestFactor
      }

      const dailyReach = Math.round(filteredReach)
      const weeklyReach = dailyReach * 7

      return {
        inventory_id: billboard.id,
        name: billboard.name,
        zone_name: billboard.zone_name,
        format: billboard.format,
        base_daily_reach: billboard.estimated_daily_reach,
        filtered_daily_reach: dailyReach,
        filtered_weekly_reach: weeklyReach,
        demographic_breakdown: profile.demographic_breakdown,
        interest_scores: profile.interest_scores,
        calculation_method: profile.calculation_method
      }
    })

    // Calcular agregados
    const totalDailyReach = results.reduce((sum, r) => sum + r.filtered_daily_reach, 0)
    const totalWeeklyReach = totalDailyReach * 7
    
    // Deduplicación: asumimos 15% de overlap
    const deduplicationFactor = 0.85
    const uniqueWeeklyReach = Math.round(totalWeeklyReach * deduplicationFactor)

    // Frecuencia promedio
    const avgFrequency = uniqueWeeklyReach > 0 
      ? Math.round((totalWeeklyReach / uniqueWeeklyReach) * 10) / 10
      : 0

    const response = {
      success: true,
      aggregate: {
        total_billboards: results.length,
        total_daily_reach: totalDailyReach,
        total_weekly_reach: totalWeeklyReach,
        unique_weekly_reach: uniqueWeeklyReach,
        avg_frequency: avgFrequency,
        total_impressions: totalWeeklyReach
      },
      by_billboard: results,
      filters_applied: filters
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error calculating audience reach:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

// ============================================================
// FUNCIONES AUXILIARES DE FILTRADO
// ============================================================

function calculateAgeFactor(
  ageDistribution: Record<string, number>,
  ageMin: number,
  ageMax: number
): number {
  let totalPct = 0

  if (ageMin <= 24 && ageMax >= 18) {
    totalPct += ageDistribution['18_24'] || 0
  }
  if (ageMin <= 34 && ageMax >= 25) {
    totalPct += ageDistribution['25_34'] || 0
  }
  if (ageMin <= 44 && ageMax >= 35) {
    totalPct += ageDistribution['35_44'] || 0
  }
  if (ageMin <= 54 && ageMax >= 45) {
    totalPct += ageDistribution['45_54'] || 0
  }
  if (ageMax >= 55) {
    totalPct += ageDistribution['55_plus'] || 0
  }

  return totalPct / 100
}

function calculateNSEFactor(
  nseDistribution: Record<string, number>,
  selectedNSE: string[]
): number {
  let totalPct = 0

  if (selectedNSE.includes('ABC1')) {
    totalPct += nseDistribution.abc1 || 0
  }
  if (selectedNSE.includes('C2')) {
    totalPct += nseDistribution.c2 || 0
  }
  if (selectedNSE.includes('C3')) {
    totalPct += nseDistribution.c3 || 0
  }

  return totalPct / 100
}

function calculateInterestFactor(
  interestScores: Record<string, number>,
  selectedInterests: string[]
): number {
  if (selectedInterests.length === 0) {
    return 1.0
  }

  // Mapeo de nombres del frontend a keys en DB
  const interestMap: Record<string, string> = {
    'Tecnología': 'tecnologia',
    'Salud & Bienestar': 'salud_bienestar',
    'Retail & Consumo': 'retail',
    'Automovilismo': 'automovilismo',
    'Gastronomía': 'gastronomia',
    'Finanzas': 'finanzas',
    'Moda & Estilo': 'moda',
    'Entretenimiento': 'entretenimiento'
  }

  const avgAffinity = selectedInterests.reduce((sum, interest) => {
    const key = interestMap[interest] || interest.toLowerCase()
    const score = interestScores[key] || 0.5
    return sum + score
  }, 0) / selectedInterests.length

  // Boost si hay alta afinidad
  return avgAffinity > 0.7 ? avgAffinity * 1.2 : avgAffinity
}
