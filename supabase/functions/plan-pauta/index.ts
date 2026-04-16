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

// CAMBIO 3 — Calcular margen neto por cartel
function calcMargin(item: any, discountPct: number): number {
  const revenue = (item.base_rate ?? 0) * (1 - discountPct / 100)
  if (revenue <= 0) return 0
  const area = (item.width_m ?? 0) * (item.height_m ?? 0)
  const fixedCosts = (item.cost_rent ?? 0) + (item.cost_electricity ?? 0) +
    (item.cost_taxes ?? 0) + (item.cost_maintenance ?? 0) + (item.cost_imponderables ?? 0)
  const campaignCosts = (item.cost_print_per_m2 ?? 0) * area +
    (item.cost_installation ?? 0) + (item.cost_design ?? 0)
  const commissions = (item.base_rate ?? 0) * (
    ((item.cost_seller_commission_pct ?? 0) +
     (item.cost_agency_commission_pct ?? 0) +
     (item.asociado_comision_pct ?? 0)) / 100
  )
  const totalCosts = fixedCosts + campaignCosts + commissions
  return (revenue - totalCosts) / revenue
}

// CAMBIO 5 — buildUserPrompt recibe any[] para soportar margin_pct
function buildUserPrompt(fd: FormData, inventory: any[], mandatoryIds: Set<string>, corridorName: string | null, audienceMode: string): string {
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
      margin_pct: item.margin_pct ?? 0,
    })
  }).join('\n')

  return `BRIEF DE CAMPAÑA:
- Cliente: ${fd.clientName}
- Objetivo: ${fd.objective}
- Presupuesto: ARS ${budget.toLocaleString('es-AR')} (precio_cliente = precio_lista × ${multiplier.toFixed(2)})
- Período: ${fd.startDate} al ${fd.endDate} (${campaignDays} días)
- Ciudades: ${fd.cities.join(', ')} | Provincias: ${fd.provinces.join(', ')}
- Formatos solicitados: ${fd.formats.join(', ')}
${fd.digitalFrequency ? `- Frecuencia digital: ${fd.digitalFrequency}` : ''}
- Audiencia: ${audienceStr}
${corridorName ? `- Corredor preferido: "${corridorName}" — priorizar sus carteles` : ''}
${mandatoryIds.size > 0 ? `- CARTELES OBLIGATORIOS: ${[...mandatoryIds].join(', ')} — incluir en ambas opciones` : ''}

INVENTARIO DISPONIBLE (${inventory.length} carteles):
${inventoryLines}

INSTRUCCIONES:
1. Incluir SIEMPRE los carteles con is_mandatory:true en ambas opciones
2. PRESUPUESTO ABSOLUTO: la suma de client_price de los sites seleccionados NO puede superar ${budget.toLocaleString('es-AR')} ARS. Verificar cartel por cartel. Si el siguiente supera el saldo, saltearlo y buscar el más barato disponible.
3. Maximizar uso del presupuesto: seguir agregando carteles hasta que el saldo restante sea menor al client_price del cartel más barato disponible
4. Opción A "Máximo Alcance": cobertura geográfica diversa, mix de formatos. Prioridad: billboard > digital > ambient > urban_furniture > poster
5. Opción B "Máximo Impacto": mayor daily_traffic absoluto, ubicaciones premium
6. Carteles digitales (digital, urban_furniture_digital): siempre disponibles aunque tengan otros clientes
7. El descuento reduce el precio de cada cartel — NO expande el presupuesto
8. NO inventar IDs — usar solo los IDs exactos del inventario
9. RENTABILIDAD: al menos el 35% de los carteles seleccionados deben ser los de mayor margin_pct. No es excluyente — si no hay suficientes carteles rentables para cubrir el presupuesto, completar con el resto.

RESPUESTA — devolvé ÚNICAMENTE este JSON:
{"audience_mode":"${audienceMode}","audience_note":${audienceMode === 'geographic_only' ? '"No hay datos de audiencia para esta zona."' : 'null'},"optionA":{"title":"Máximo Alcance","rationale":"estrategia en 2-3 oraciones","sites":[{"id":"UUID_EXACTO","name":"nombre","address":"dirección","city":"ciudad","province":"","format":"formato","latitude":0.0,"longitude":0.0,"monthly_impacts":0,"list_price":0,"client_price":0,"audience_score":75,"is_mandatory":false,"justification":"razón breve"}],"total_list_price":0,"total_client_price":0,"discount_amount":0,"budget_remaining":0,"next_billboard_gap":0,"total_impacts":0,"estimated_reach":0,"cpm":0,"format_mix":{}},"optionB":{"title":"Máximo Impacto","rationale":"estrategia en 2-3 oraciones","sites":[],"total_list_price":0,"total_client_price":0,"discount_amount":0,"budget_remaining":0,"next_billboard_gap":0,"total_impacts":0,"estimated_reach":0,"cpm":0,"format_mix":{}}}`
}

function extractJSON(text: string): string {
  let clean = text
    .replace(/^```[a-zA-Z]*\s*/gm, '')
    .replace(/```\s*$/gm, '')
    .trim()
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

    // CAMBIO 1 — Query con campos de costos ampliados
    let query = supabase
      .from('inventory')
      .select('id, name, format, address, city, latitude, longitude, daily_traffic, base_rate, illuminated, cluster_audiencia, cost_rent, cost_electricity, cost_taxes, cost_maintenance, cost_imponderables, cost_print_per_m2, cost_installation, cost_design, cost_seller_commission_pct, cost_agency_commission_pct, asociado_comision_pct, width_m, height_m')
      .eq('org_id', orgId)
      .eq('is_available', true)
      .gte('base_rate', 100000)
      .limit(40)

    if (formats.length > 0) {
      const dbFormats = formats.includes('ambient')
        ? [...new Set([...formats, 'billboard'])]
        : formats
      query = query.in('format', dbFormats)
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
        JSON.stringify({ error: 'No hay carteles disponibles con los filtros seleccionados.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // CAMBIO 2 — Excluir carteles ocupados en las fechas de la campaña
    const { data: occupiedItems } = await supabase
      .from('proposal_items')
      .select('site_id, proposals!inner(status)')
      .lte('start_date', formData.endDate)
      .gte('end_date', formData.startDate)
      .eq('proposals.status', 'accepted')

    const occupiedIds = new Set((occupiedItems ?? []).map((x: any) => x.site_id))
    const DIGITAL_FORMATS = new Set(['digital', 'urban_furniture_digital'])

    const availableInventory = inventory.filter((item: any) =>
      DIGITAL_FORMATS.has(item.format) || !occupiedIds.has(item.id)
    )

    if (availableInventory.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No hay carteles disponibles para las fechas seleccionadas.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
      const presentIds = new Set(availableInventory.map((i: any) => i.id))
      const missingMandatory = [...mandatoryIds].filter(id => !presentIds.has(id))
      if (missingMandatory.length > 0) {
        // CAMBIO 1 — mismo select ampliado para los obligatorios faltantes
        const { data: extra } = await supabase
          .from('inventory')
          .select('id, name, format, address, city, latitude, longitude, daily_traffic, base_rate, illuminated, cluster_audiencia, cost_rent, cost_electricity, cost_taxes, cost_maintenance, cost_imponderables, cost_print_per_m2, cost_installation, cost_design, cost_seller_commission_pct, cost_agency_commission_pct, asociado_comision_pct, width_m, height_m')
          .in('id', missingMandatory)
        // CAMBIO 7 — push a availableInventory
        if (extra) availableInventory.push(...extra)
      }
    }

    // CAMBIO 7 — hasAudienceData desde availableInventory
    const hasAudienceData = availableInventory.some((item: any) => item.cluster_audiencia != null && item.cluster_audiencia !== '')
    const audienceMode = hasAudienceData ? 'full' : 'geographic_only'

    // CAMBIO 4 — Enriquecer con margin_pct
    const enrichedInventory = availableInventory.map((item: any) => ({
      ...item,
      margin_pct: Math.round(calcMargin(item, formData.discountPct ?? 0) * 100)
    }))

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurado.')

    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model:       'claude-haiku-4-5-20251001',
      max_tokens:  16000,
      temperature: 0.2,
      system:      SYSTEM_PROMPT,
      // CAMBIO 7 — usar enrichedInventory
      messages:    [{ role: 'user', content: buildUserPrompt(formData as FormData, enrichedInventory, mandatoryIds, corridorName, audienceMode) }],
    })

    const rawText = (message.content[0] as { text: string }).text.trim()

    let result
    try {
      const jsonStr = extractJSON(rawText)
      result = JSON.parse(jsonStr)
    } catch (parseErr) {
      console.error('Parse error:', (parseErr as Error).message)
      console.error('Raw response (500 chars):', rawText.slice(0, 500))
      return new Response(
        JSON.stringify({ error: 'La IA no devolvió JSON válido. Intentá de nuevo.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!result?.optionA || !result?.optionB) {
      return new Response(
        JSON.stringify({ error: 'La IA no generó las dos opciones. Intentá de nuevo.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // CAMBIO 6 — capBudget + auto-fill restante + next_billboard server-side
    const budget = Number(formData.budget) || 0
    const disc = formData.discountPct ?? 0
    const mult = 1 - disc / 100

    // Enriquecer enrichedInventory con client_price para comparar fácil
    const invWithPrice = enrichedInventory.map((item: any) => ({
      ...item,
      client_price: Math.round((item.base_rate ?? 0) * mult),
    }))

    for (const [optIndex, opt] of [result.optionA, result.optionB].entries()) {
      // 1. capBudget — validar los sites que seleccionó la IA
      let remaining = budget
      const kept: any[] = []
      for (const site of (opt.sites ?? [])) {
        const cp = site.client_price > 0
          ? site.client_price
          : Math.round((site.list_price ?? 0) * mult)
        if (cp > 0 && cp <= remaining) {
          kept.push({ ...site, client_price: cp })
          remaining -= cp
        }
      }

      // 2. Auto-fill — agregar carteles del inventario que quepan en el saldo
      const selectedIds = new Set(kept.map((s: any) => s.id))

      // Ordenar candidatos: optionB por daily_traffic DESC, optionA por mix de formato
      const candidates = invWithPrice
        .filter((item: any) => !selectedIds.has(item.id) && item.client_price > 0 && item.client_price <= remaining)
        .sort((a: any, b: any) =>
          optIndex === 1
            ? (b.daily_traffic ?? 0) - (a.daily_traffic ?? 0)   // Máximo Impacto: mayor tráfico
            : (b.monthly_impacts ?? b.daily_traffic * 30 ?? 0) - (a.monthly_impacts ?? a.daily_traffic * 30 ?? 0)
        )

      for (const candidate of candidates) {
        if (candidate.client_price > remaining) continue
        kept.push({
          id:              candidate.id,
          name:            candidate.name,
          address:         candidate.address,
          city:            candidate.city,
          format:          candidate.format,
          latitude:        candidate.latitude,
          longitude:       candidate.longitude,
          monthly_impacts: candidate.daily_traffic ? candidate.daily_traffic * 30 : 0,
          list_price:      candidate.base_rate ?? 0,
          client_price:    candidate.client_price,
          audience_score:  75,
          is_mandatory:    false,
          justification:   optIndex === 1
            ? `Mayor tráfico disponible${candidate.daily_traffic ? ` (${candidate.daily_traffic.toLocaleString('es-AR')} diarios)` : ''}, completando presupuesto`
            : `Cobertura adicional, completando presupuesto`,
          illuminated:     candidate.illuminated,
        })
        remaining -= candidate.client_price
        selectedIds.add(candidate.id)
        if (remaining <= 0) break
      }

      // 3. Recalcular totales
      opt.sites = kept
      opt.total_client_price = kept.reduce((s: number, x: any) => s + x.client_price, 0)
      opt.total_list_price   = kept.reduce((s: number, x: any) => s + (x.list_price ?? 0), 0)
      opt.discount_amount    = opt.total_list_price - opt.total_client_price
      opt.budget_remaining   = budget - opt.total_client_price
      const ti = kept.reduce((s: number, x: any) => s + (x.monthly_impacts ?? 0), 0)
      opt.total_impacts = ti
      opt.cpm = ti > 0 ? Math.round(opt.total_client_price / (ti / 1000)) : 0

      // 4. next_billboard — el más barato no seleccionado
      const nextBillboard = invWithPrice
        .filter((item: any) => !selectedIds.has(item.id) && item.client_price > 0)
        .sort((a: any, b: any) => a.client_price - b.client_price)[0]

      if (nextBillboard) {
        opt.next_billboard_gap        = Math.max(0, nextBillboard.client_price - opt.budget_remaining)
        opt.next_billboard_id         = nextBillboard.id
        opt.next_billboard_name       = nextBillboard.name
        opt.next_billboard_price      = nextBillboard.client_price
        opt.next_billboard_list_price = nextBillboard.base_rate ?? 0
      } else {
        opt.next_billboard_gap  = 0
        opt.next_billboard_id   = null
        opt.next_billboard_name = null
        opt.next_billboard_price = 0
      }
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