import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.37.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FormData {
  clientName: string
  clientEmail?: string
  objective: string
  formats: string[]
  digitalFrequency?: string
  provinces: string[]
  cities: string[]
  corridorId?: string | null
  corridorName?: string | null
  fixedBillboards?: Array<{ id: string; name: string; address: string }>
  budget: string
  discountPct: number
  startDate: string
  endDate: string
  audience?: {
    ageMin?: number
    ageMax?: number
    gender?: string
    interests?: string[]
    nse?: string[]
  }
}

interface InventoryItem {
  id: string
  name: string
  format: string
  address: string
  city: string
  latitude: number | null
  longitude: number | null
  daily_traffic: number | null
  base_rate: number | null
  illuminated: boolean
  cluster_audiencia: string | null
}

const SYSTEM_PROMPT = `Sos un experto en planificación publicitaria OOH en Argentina.
Conocés el mercado de vía pública, los corredores publicitarios y la comercialización por agencias.
Respondé EXCLUSIVAMENTE con JSON válido. No uses markdown, no uses bloques de código, no uses comillas triples. Solo el objeto JSON puro.`

function buildUserPrompt(fd: FormData, inventory: InventoryItem[], mandatoryIds: Set<string>, corridorName: string | null, audienceMode: string): string {
  const budget = Number(fd.budget) || 0
  const discountPct = fd.discountPct ?? 0
  const multiplier = 1 - discountPct / 100

  const campaignDays = fd.startDate && fd.endDate
    ? Math.ceil((new Date(fd.endDate).getTime() - new Date(fd.startDate).getTime()) / 86400000)
    : 30

  const audienceStr = (() => {
    const a = fd.audience ?? {}
    const parts: string[] = []
    if (a.ageMin || a.ageMax) parts.push(`edad ${a.ageMin ?? 18}-${a.ageMax ?? 55} años`)
    if (a.gender && a.gender !== 'all') parts.push(`género: ${a.gender === 'male' ? 'masculino' : 'femenino'}`)
    if (a.interests?.length) parts.push(`intereses: ${a.interests.join(', ')}`)
    if (a.nse?.length) parts.push(`NSE: ${a.nse.join('/')}`)
    return parts.join(' | ') || 'No especificada'
  })()

  const inventoryLines = inventory.map(item => {
    const clientPrice = item.base_rate ? Math.round(item.base_rate * multiplier) : null
    const impacts = item.daily_traffic ? item.daily_traffic * 30 : null
    const mandatory = mandatoryIds.has(item.id)
    const audienceInfo = item.cluster_audiencia
      ? `audiencia: ${item.cluster_audiencia}`
      : 'sin datos de audiencia'
    return JSON.stringify({
      id: item.id,
      name: item.name,
      address: item.address,
      city: item.city,
      format: item.format,
      illuminated: item.illuminated,
      daily_traffic: item.daily_traffic ?? 0,
      monthly_impacts: impacts ?? 0,
      list_price: item.base_rate ?? 0,
      client_price: clientPrice ?? 0,
      latitude: item.latitude,
      longitude: item.longitude,
      audience_info: audienceInfo,
      is_mandatory: mandatory,
    })
  }).join('\n')

  const audienceNote = audienceMode === 'geographic_only'
    ? '\nMODO GEOGRÁFICO: No hay datos de audiencia para esta zona. Planificá según tráfico_diario y densidad geográfica.'
    : ''

  return `BRIEF DE CAMPAÑA:
- Cliente: ${fd.clientName}
- Objetivo: ${fd.objective}
- Presupuesto del cliente: ARS ${budget.toLocaleString('es-AR')}
- Descuento aplicado: ${discountPct}% (precio_cliente = precio_lista × ${multiplier.toFixed(2)})
- Período: ${fd.startDate} al ${fd.endDate} (${campaignDays} días)
- Ciudades: ${fd.cities.join(', ')}
- Provincias: ${fd.provinces.join(', ')}
- Formatos solicitados: ${fd.formats.join(', ')}
${fd.digitalFrequency ? `- Frecuencia digital: ${fd.digitalFrequency}` : ''}
- Audiencia: ${audienceStr}
- Modo audiencia: ${audienceMode}${audienceNote}
${corridorName ? `- Corredor preferido: "${corridorName}" — priorizar sus carteles` : ''}
${mandatoryIds.size > 0 ? `- CARTELES OBLIGATORIOS (id): ${[...mandatoryIds].join(', ')} — incluir SIEMPRE en ambas opciones` : ''}

INVENTARIO DISPONIBLE (${inventory.length} carteles):
${inventoryLines}

INSTRUCCIONES:
1. Incluir SIEMPRE los carteles marcados con is_mandatory:true en ambas opciones
2. Respetar el corredor preferido (si aplica) priorizando sus carteles
3. La suma de client_price de los carteles seleccionados NO debe superar el presupuesto (${budget})
4. Seleccionar entre 3 y 10 carteles por opción
5. Si hay presupuesto sobrante, indicarlo en budget_remaining
6. Si no alcanza para un cartel más, calcular el gap (next_billboard_gap = precio del siguiente - sobrante)
7. Opción A "Máximo Alcance": mayor cobertura geográfica, diversidad de zonas y formatos
8. Opción B "Máximo Impacto": mejor match de audiencia, mayor tráfico y ubicaciones premium
${audienceMode === 'geographic_only' ? '9. En Opción B, priorizar carteles con mayor daily_traffic y densidad poblacional de la zona' : ''}

RESPUESTA REQUERIDA — devolvé ÚNICAMENTE este JSON sin ningún texto adicional:
{"audience_mode":"${audienceMode}","audience_note":${audienceMode === 'geographic_only' ? '"No hay datos de audiencia para esta zona. La planificación se basa en tránsito y densidad poblacional."' : 'null'},"optionA":{"title":"Máximo Alcance","rationale":"explica la estrategia","sites":[{"id":"uuid","name":"nombre","address":"dirección","city":"ciudad","province":"provincia","format":"formato","latitude":0.0,"longitude":0.0,"monthly_impacts":0,"list_price":0,"client_price":0,"audience_score":75,"is_mandatory":false,"justification":"razón"}],"total_list_price":0,"total_client_price":0,"discount_amount":0,"budget_remaining":0,"next_billboard_gap":0,"total_impacts":0,"estimated_reach":0,"cpm":0,"format_mix":{}},"optionB":{"title":"Máximo Impacto","rationale":"explica la estrategia","sites":[],"total_list_price":0,"total_client_price":0,"discount_amount":0,"budget_remaining":0,"next_billboard_gap":0,"total_impacts":0,"estimated_reach":0,"cpm":0,"format_mix":{}}}`
}

/** Extrae el primer objeto JSON válido del texto */
function extractJSON(text: string): string {
  // Remover bloques de código markdown
  let clean = text
    .replace(/^```[a-zA-Z]*\s*/gm, '')
    .replace(/```\s*$/gm, '')
    .trim()

  // Buscar el primer { y el último } balanceado
  const start = clean.indexOf('{')
  if (start === -1) throw new Error('No se encontró JSON en la respuesta')

  let depth = 0
  let end = -1
  for (let i = start; i < clean.length; i++) {
    if (clean[i] === '{') depth++
    else if (clean[i] === '}') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }

  if (end === -1) throw new Error('JSON incompleto en la respuesta')
  return clean.slice(start, end + 1)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { formData, orgId }: { formData: FormData; orgId: string } = await req.json()

    if (!formData || !orgId) {
      return new Response(
        JSON.stringify({ error: 'formData y orgId son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const cities  = formData.cities  ?? []
    const formats = formData.formats ?? []

    // ── PASO 1: Leer inventario filtrado ─────────────────────
    let query = supabase
      .from('inventory')
      .select('id, name, format, address, city, latitude, longitude, daily_traffic, base_rate, illuminated, cluster_audiencia')
      .eq('org_id', orgId)
      .eq('is_available', true)
      .limit(60)

    if (formats.length > 0) {
      query = query.in('format', formats)
    }

    if (cities.length === 1) {
      query = query.ilike('city', `%${cities[0]}%`)
    } else if (cities.length > 1) {
      query = query.or(cities.map(c => `city.ilike.%${c}%`).join(','))
    }

    const { data: inventory, error: dbErr } = await query

    if (dbErr) throw new Error(`DB error: ${dbErr.message}`)
    if (!inventory || inventory.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No hay carteles disponibles con los filtros seleccionados. Revisá las ciudades y formatos elegidos.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── PASO 2: Corredores y carteles obligatorios ───────────
    const mandatoryIds = new Set<string>(
      (formData.fixedBillboards ?? []).map(b => b.id).filter(Boolean)
    )

    let corridorName: string | null = formData.corridorName ?? null

    if (formData.corridorId) {
      const { data: corridor } = await supabase
        .from('corridors')
        .select('name, inventory_ids')
        .eq('id', formData.corridorId)
        .single()

      if (corridor) {
        corridorName = corridor.name
        ;(corridor.inventory_ids ?? []).forEach((id: string) => mandatoryIds.add(id))
      }
    }

    if (mandatoryIds.size > 0) {
      const presentIds = new Set(inventory.map(i => i.id))
      const missingMandatory = [...mandatoryIds].filter(id => !presentIds.has(id))

      if (missingMandatory.length > 0) {
        const { data: extra } = await supabase
          .from('inventory')
          .select('id, name, format, address, city, latitude, longitude, daily_traffic, base_rate, illuminated, cluster_audiencia')
          .in('id', missingMandatory)

        if (extra) inventory.push(...extra)
      }
    }

    // ── PASO 3: Modo audiencia ───────────────────────────────
    const hasAudienceData = inventory.some(item => item.cluster_audiencia != null && item.cluster_audiencia !== '')
    const audienceMode = hasAudienceData ? 'full' : 'geographic_only'

    // ── PASO 4: Llamar a Claude Haiku ────────────────────────
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurado en los secrets de la Edge Function.')

    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model:       'claude-haiku-4-5-20251001',
      max_tokens:  4096,
      temperature: 0.2,
      system:      SYSTEM_PROMPT,
      messages:    [{ role: 'user', content: buildUserPrompt(formData as FormData, inventory, mandatoryIds, corridorName, audienceMode) }],
    })

    const rawText = (message.content[0] as { text: string }).text.trim()

    // ── PASO 5: Parsear con extractor robusto ────────────────
    let result
    try {
      const jsonStr = extractJSON(rawText)
      result = JSON.parse(jsonStr)
    } catch (parseErr) {
      console.error('Parse error:', (parseErr as Error).message)
      console.error('Claude raw response (first 500):', rawText.slice(0, 500))
      return new Response(
        JSON.stringify({ error: 'La IA no devolvió JSON válido. Intentá de nuevo.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!result?.optionA || !result?.optionB) {
      return new Response(
        JSON.stringify({ error: 'La IA no generó las dos opciones requeridas. Intentá de nuevo.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('plan-pauta error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
