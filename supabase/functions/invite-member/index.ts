import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_CALLER_ROLES = new Set(['owner', 'manager'])
const ALLOWED_INVITE_ROLES = new Set(['manager', 'salesperson'])
const INVITES_PER_DAY      = 20
const EMAIL_RE             = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildInviteHtml(params: {
  actionLink: string
  orgName: string
  roleLabel: string
  fullName: string | null
}): string {
  const { actionLink, orgName, roleLabel, fullName } = params
  const greeting = fullName ? `Hola ${fullName},` : 'Hola,'
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:540px;margin:0 auto;color:#1e293b">
      <div style="background:#6366f1;padding:32px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:#fff;font-size:20px;margin:0;font-weight:700">Te invitaron a unirte a ${orgName}</h1>
        <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:8px 0 0 0">en OOH Planner</p>
      </div>
      <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px 0">${greeting}</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px 0;color:#475569">
          Fuiste invitado/a a <strong>${orgName}</strong> como <strong>${roleLabel}</strong> en OOH Planner,
          la plataforma de gestión de publicidad exterior.
        </p>
        <div style="text-align:center;margin:32px 0">
          <a href="${actionLink}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 6px rgba(99,102,241,0.35)">
            Aceptar invitación
          </a>
        </div>
        <p style="font-size:12px;line-height:1.6;margin:24px 0 0 0;color:#94a3b8;text-align:center">
          O copiá este link en tu navegador:<br>
          <span style="word-break:break-all;color:#64748b;font-family:monospace;font-size:11px">${actionLink}</span>
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0">
        <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0">
          Si no esperabas esta invitación, podés ignorar este email.<br>
          Contacto: <a href="mailto:hola@oohplanner.net" style="color:#6366f1">hola@oohplanner.net</a>
        </p>
      </div>
    </div>
  `
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // ── 1. Authenticate caller ──────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser()
    if (callerErr || !caller) return json({ error: 'Invalid token' }, 401)

    const service = createClient(SUPABASE_URL, SERVICE_KEY)

    // ── 2. Authorize caller (owner/manager OR admin) ────────────────
    const [{ data: callerProfile }, { data: admin }] = await Promise.all([
      service.from('profiles').select('org_id, role').eq('id', caller.id).maybeSingle(),
      service.from('admin_users').select('admin_role').eq('id', caller.id).maybeSingle(),
    ])

    const isAdmin    = !!admin
    const hasOrgRole = !!callerProfile && ALLOWED_CALLER_ROLES.has(callerProfile.role)
    if (!isAdmin && !hasOrgRole) return json({ error: 'Forbidden' }, 403)

    // Inviting requires an org to invite into. Admins without a profile must
    // pass org_id explicitly (out of scope here — they use the admin panel).
    if (!callerProfile?.org_id) {
      return json({ error: 'Caller must belong to an organisation' }, 403)
    }
    const orgId = callerProfile.org_id

    // ── 3. Validate body ────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON body' }, 400)

    const rawEmail = (body as any).email
    const role     = (body as any).role
    const fullName = (body as any).full_name ?? null

    if (typeof rawEmail !== 'string' || !EMAIL_RE.test(rawEmail)) {
      return json({ error: 'Invalid email' }, 400)
    }
    const email = rawEmail.trim().toLowerCase()

    if (typeof role !== 'string' || !ALLOWED_INVITE_ROLES.has(role)) {
      return json({ error: "Role must be 'manager' or 'salesperson'" }, 400)
    }
    if (fullName !== null && (typeof fullName !== 'string' || fullName.length > 200)) {
      return json({ error: 'Invalid full_name' }, 400)
    }

    // ── 4. Rate limit: 20 invites/day per org ───────────────────────
    const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString()
    const { count } = await service
      .from('email_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('purpose', 'invite')
      .gte('created_at', oneDayAgo)
    if ((count ?? 0) >= INVITES_PER_DAY) {
      return json({ error: `Invite limit reached: ${INVITES_PER_DAY}/day` }, 429)
    }

    // ── 5. Generate invite link via Supabase Auth admin API ─────────
    // If the user does not exist, this creates an auth.users row — which
    // fires the handle_new_user trigger (schema.sql) to auto-create the
    // matching profiles row using org_id/role/full_name from metadata.
    // If the user already exists, no trigger fires; we detect their state
    // below and either reject (already in team) or update their profile.
    const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: {
          org_id:    orgId,
          role,
          full_name: fullName,
        },
      },
    })
    if (linkErr || !linkData) {
      return json({ error: linkErr?.message ?? 'Failed to generate invite link' }, 500)
    }

    const actionLink     = (linkData as any).properties?.action_link
    const invitedUserId  = (linkData as any).user?.id
    if (!actionLink || !invitedUserId) {
      return json({ error: 'Invite link response incomplete' }, 500)
    }

    // ── 6. Reconcile profile state ──────────────────────────────────
    const { data: existingProfile } = await service
      .from('profiles')
      .select('id, org_id, is_active')
      .eq('id', invitedUserId)
      .maybeSingle()

    if (existingProfile) {
      if (existingProfile.org_id && existingProfile.org_id !== orgId) {
        return json({ error: 'Email already belongs to another organisation' }, 409)
      }
      if (existingProfile.is_active) {
        return json({ error: 'User is already an active member of this organisation' }, 409)
      }
      // Pending re-invite or trigger-created row: mark inactive and sync metadata.
      const { error: updErr } = await service
        .from('profiles')
        .update({
          is_active: false,
          role,
          full_name: fullName ?? null,
          org_id:    orgId,
        })
        .eq('id', invitedUserId)
      if (updErr) console.warn('profile update failed:', updErr.message)
    } else {
      // Trigger didn't create one (existing auth user with no profile, or
      // trigger skipped for some reason). Insert manually as fallback.
      const { error: insErr } = await service.from('profiles').insert({
        id:        invitedUserId,
        org_id:    orgId,
        role,
        full_name: fullName ?? null,
        is_active: false,
      })
      if (insErr) console.warn('profile insert failed:', insErr.message)
    }

    // ── 7. Look up org name for the email ───────────────────────────
    const { data: org } = await service
      .from('organisations')
      .select('name')
      .eq('id', orgId)
      .single()
    const orgName    = org?.name ?? 'OOH Planner'
    const roleLabel  = role === 'manager' ? 'Manager' : 'Vendedor'

    // ── 8. Send branded email via send-email edge function ──────────
    //     Pass through the caller's Authorization so send-email can
    //     attribute + audit + rate-limit under their identity.
    const html = buildInviteHtml({ actionLink, orgName, roleLabel, fullName })
    const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        Authorization:    authHeader,
        'Content-Type':   'application/json',
        apikey:           ANON_KEY,
      },
      body: JSON.stringify({
        to:      email,
        subject: `Te invitaron a unirte a ${orgName} en OOH Planner`,
        html,
        purpose: 'invite',
      }),
    })

    if (!emailRes.ok) {
      const errBody = await emailRes.json().catch(() => ({} as any))
      // Invite user was created; email delivery failed. Surface as partial success.
      return json({
        warning:    'Invite created but email delivery failed',
        invite_id:  invitedUserId,
        email_error: errBody?.error ?? 'unknown',
      }, 207)
    }

    return json({
      success:    true,
      invite_id:  invitedUserId,
      email,
      role,
    }, 200)

  } catch (err) {
    console.error('invite-member error:', err instanceof Error ? err.message : err)
    return json({ error: 'Internal error' }, 500)
  }
})
