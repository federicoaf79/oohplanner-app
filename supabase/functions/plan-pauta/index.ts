import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.37.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Prompt ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un experto en planificación de medios OOH (Out-of-Home) en Argentina.
Recibirás los datos de una campaña y un inventario de soportes disponibles.
Tu misión es generar DOS propuestas de pauta distintas y complementarias.

REGLAS ESTRICTAS:
1. Responde EXCLUSIVAMENTE con JSON válido, sin markdown, sin texto extra, sin bloques de código.
2. Selecciona entre 3 y 8 soportes por opción, tomando solo del inventario recibido.
3. Opción A "Máximo Alcance": prioriza cobertura geográfica, diversidad de zonas.
4. Opción B "Máximo Impacto": prioriza daily_traffic alto y formatos digitales si los hay.
5. La suma de base_rate de los soportes seleccionados NO debe superar el budget.
6. audienceMatchScore (0-100): estimá el match entre el soporte y la audiencia descrita.

ESQUEMA DE RESPUESTA (seguilo exactamente):
{
  "optionA": {
    "label": "Máximo Alcance",
    "rationale": "2 oraciones explicando la estrategia",
    "sites": [
      {
        "site_id": "string",
        "name": "string",
        "format": "billboard|digital|ambient",
        "address": "string",
        "city": "string",
        "latitude": number,
        "longitude": number,
        "rate": number,
        "dailyTraffic": number,
        "impactsPerMonth": number,
        "audienceMatchScore": number,
        "justification": "1 oración"
      }
    ],
    "metrics": {
      "totalRate": number,
      "budgetAvailable": number,
      "budgetUsedPct": number,
      "totalImpactsPerMonth": number,
      "estimatedReach": number,
      "estimatedCPM": number,
      "formatMix": { "billboard": number, "digital": number, "ambient": number }
    }
  },
  "optionB": { ...mismo esquema... }
}`

function buildUserPrompt(fd: Record<string, unknown>, inventory: Record<string, unknown>[]): string {
  const budget = Number(fd.budget) || 0
  const campaignDays = fd.startDate && fd.endDate
    ? Math.ceil((new Date(fd.endDate as string).getTime() - new Date(fd.startDate as string).getTime()) / 86400000)
    : 30

  const audienceStr = fd.audience
    ? (() => {
        const a = fd.audience as Record<string, unknown>
        const parts = []
        if (a.ageMin || a.ageMax) parts.push(`edad ${a.ageMin}-${a.ageMax} años`)
        if (a.gender && a.gender !== 'all') parts.push(`género: ${a.gender}`)
        if (Array.isArray(a.interests) && a.interests.length) parts.push(`intereses: ${(a.interests as string[]).join(', ')}`)
        if (Array.isArray(a.nse) && a.nse.length) parts.push(`NSE: ${(a.nse as string[]).join('/')}`)
        return parts.join(' | ') || 'No especificada'
      })()
    : 'No especificada'

  return `BRIEF DE CAMPAÑA:
- Cliente: ${fd.clientName}
- Objetivo: ${fd.objective}
- Ciudad: ${fd.city}
- Formatos solicitados: ${(fd.formats as string[]).join(', ')}
${(fd.formats as string[]).includes('digital') ? `- Frecuencia digital preferida: ${fd.digitalFrequency}` : ''}
- Presupuesto mensual: ARS ${budget.toLocaleString('es-AR')}
- Período: ${fd.startDate} al ${fd.endDate} (${campaignDays} días)
- Audiencia objetivo: ${audienceStr}

INVENTARIO DISPONIBLE (${inventory.length} soportes):
${JSON.stringify(inventory, null, 2)}

Genera las 2 opciones de pauta siguiendo el esquema exacto. El budget es ${budget} ARS.`
}

// ── Handler ─────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { formData, orgId } = await req.json()

    if (!formData || !orgId) {
      return new Response(JSON.stringify({ error: 'formData y orgId son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 1. Query inventory ───────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const formats: string[] = formData.formats ?? []

    const { data: inventory, error: dbErr } = await supabase
      .from('inventory')
      .select('id, name, format, address, city, latitude, longitude, daily_traffic, base_rate, illuminated')
      .eq('org_id', orgId)
      .ilike('city', `%${(formData.city as string).split(' ')[0]}%`)
      .in('format', formats.length > 0 ? formats : ['billboard', 'digital', 'ambient'])
      .eq('is_available', true)
      .limit(40)

    if (dbErr) throw new Error(`DB error: ${dbErr.message}`)
    if (!inventory || inventory.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No hay carteles disponibles con los filtros seleccionados.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Flatten for the prompt (rename fields to be clear)
    const inventoryForPrompt = inventory.map(s => ({
      site_id:      s.id,
      name:         s.name,
      format:       s.format,
      address:      s.address,
      city:         s.city,
      latitude:     s.latitude,
      longitude:    s.longitude,
      base_rate:    s.base_rate,
      daily_traffic: s.daily_traffic ?? 50000,
      illuminated:  s.illuminated,
    }))

    // ── 2. Call Claude ───────────────────────────────────────
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurado')

    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildUserPrompt(formData, inventoryForPrompt) }
      ],
    })

    const rawText = (message.content[0] as { text: string }).text.trim()

    // ── 3. Parse JSON ────────────────────────────────────────
    let result
    try {
      // Strip markdown fences if present
      const jsonStr = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
      result = JSON.parse(jsonStr)
    } catch {
      console.error('Claude raw response:', rawText)
      return new Response(
        JSON.stringify({ error: 'La IA no devolvió JSON válido. Intentá de nuevo.', raw: rawText.slice(0, 300) }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('plan-pauta error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
