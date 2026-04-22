import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Any authenticated user with a profile can open support tickets.
// This function hardcodes recipient + purpose, so it's safe to expose widely.

const SUPPORT_EMAIL   = 'hola@oohplanner.net'
const SUBJECT_PREFIX  = 'Support Ticket: '
const RATE_LIMIT_MIN  = 10   // tickets/min per org
const RATE_LIMIT_DAY  = 100  // tickets/day per org

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? ''
    const ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

    // ── 1. Authenticate ─────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Invalid token' }, 401)

    const service = createClient(SUPABASE_URL, SERVICE_KEY)

    // ── 2. Authorize: any authenticated user with a profile ─────────
    const { data: profile } = await service
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile) return json({ error: 'Forbidden (no profile)' }, 403)

    const orgId = profile.org_id

    // ── 3. Parse & validate body ────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON body' }, 400)

    const { subject, html, text } = body as Record<string, unknown>
    if (!subject || !html) return json({ error: 'Missing required fields: subject, html' }, 400)
    if (typeof subject !== 'string' || /[\r\n]/.test(subject)) {
      return json({ error: 'Invalid subject (must be string without newlines)' }, 400)
    }

    const prefixedSubject = `${SUBJECT_PREFIX}${subject}`

    // ── 4. Rate limit per org ───────────────────────────────────────
    const oneMinAgo = new Date(Date.now() -      60_000).toISOString()
    const oneDayAgo = new Date(Date.now() -  86_400_000).toISOString()

    const { count: minCount } = await service
      .from('email_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', oneMinAgo)
    if ((minCount ?? 0) >= RATE_LIMIT_MIN) {
      return json({ error: `Rate limit exceeded: ${RATE_LIMIT_MIN}/min` }, 429)
    }

    const { count: dayCount } = await service
      .from('email_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', oneDayAgo)
    if ((dayCount ?? 0) >= RATE_LIMIT_DAY) {
      return json({ error: `Rate limit exceeded: ${RATE_LIMIT_DAY}/day` }, 429)
    }

    // ── 5. Send via Resend ──────────────────────────────────────────
    if (!RESEND_API_KEY) return json({ error: 'Email service not configured' }, 500)

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OOH Planner <noreply@oohplanner.net>',
        to: [SUPPORT_EMAIL],
        subject: prefixedSubject,
        html,
        ...(text ? { text } : {}),
      }),
    })
    const resendData = await resendRes.json().catch(() => ({} as Record<string, unknown>))

    // ── 6. Log ──────────────────────────────────────────────────────
    const status       = resendRes.ok ? 'sent' : 'failed'
    const errorMessage = resendRes.ok
      ? null
      : (resendData as any)?.message ?? (resendData as any)?.error ?? 'Resend error'

    const { error: logErr } = await service.from('email_send_log').insert({
      org_id:          orgId,
      sent_by:         user.id,
      recipient_email: SUPPORT_EMAIL,
      subject:         prefixedSubject,
      purpose:         'support',
      resend_id:       (resendData as any)?.id ?? null,
      status,
      error_message:   errorMessage,
    })
    if (logErr) console.warn('email_send_log insert failed:', logErr.message)

    return json(resendRes.ok ? resendData : { error: 'Send failed' }, resendRes.ok ? 200 : 400)

  } catch (err) {
    console.error('send-support-ticket error:', err instanceof Error ? err.message : err)
    return json({ error: 'Internal error' }, 500)
  }
})
