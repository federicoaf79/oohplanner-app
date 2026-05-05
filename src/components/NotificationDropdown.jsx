import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, MessageCircle, UserPlus, Calendar,
  ChevronRight, Inbox, DollarSign, Bell,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 1)   return 'ahora'
  if (mins < 60)  return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30)  return `hace ${days}d`
  return `hace ${Math.floor(days/30)}m`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

const EMPTY = { tickets: [], invites: [], expiring: [], campaigns: [], commissions: [] }

export default function NotificationDropdown({ open, onClose, onCountChange }) {
  const { profile, org, isOwner } = useAuth()
  const navigate   = useNavigate()
  const orgId      = profile?.org_id ?? null

  const [data,      setData]    = useState(EMPTY)
  const [loading,   setLoading] = useState(false)
  const [activeTab, setActive]  = useState('all')

  const loadAll = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const nowIso   = new Date().toISOString()
    const in90Days = new Date(Date.now() + 90 * 86_400_000).toISOString()

    const [tickets, invites, expiring, campaigns, commissions] = await Promise.all([
      supabase.from('support_tickets')
        .select('id, subject, status, priority, created_at')
        .eq('org_id', orgId).neq('status','resolved').neq('status','closed')
        .order('created_at', { ascending: false }).limit(10)
        .then(({ data, error }) => { if (error) return []; return data ?? [] }),

      supabase.from('profiles')
        .select('id, full_name, role, created_at')
        .eq('org_id', orgId).eq('is_active', false)
        .order('created_at', { ascending: false }).limit(10)
        .then(({ data, error }) => { if (error) return []; return data ?? [] }),

      supabase.from('inventory')
        .select('id, name, code, permit_expiry')
        .eq('org_id', orgId).gte('permit_expiry', nowIso).lte('permit_expiry', in90Days)
        .order('permit_expiry', { ascending: true }).limit(10)
        .then(({ data, error }) => { if (error) return []; return data ?? [] }),

      supabase.from('proposals')
        .select('id, title, client_name, end_date, status')
        .eq('org_id', orgId).eq('status', 'accepted')
        .lt('end_date', nowIso.slice(0,10))
        .order('end_date', { ascending: true }).limit(10)
        .then(({ data, error }) => { if (error) return []; return data ?? [] }),

      isOwner
        ? supabase.from('campaign_commissions')
            .select(`id, commission_type, commission_pct,
              proposal:proposals(id, title, client_name),
              seller:profiles!beneficiary_profile_id(id, full_name, commission_pct),
              contact:contacts!beneficiary_contact_id(id, name)`)
            .eq('org_id', orgId).not('commission_pct','is',null)
            .order('created_at', { ascending: false }).limit(100)
            .then(({ data, error }) => {
              if (error) return []
              return (data ?? []).filter(c => {
                const pct = Number(c.commission_pct) || 0
                if (c.commission_type === 'internal_seller' && c.seller) {
                  const profilePct = Number(c.seller.commission_pct) || 0
                  return profilePct > 0 && pct > profilePct
                }
                return pct > 20
              })
            })
        : Promise.resolve([]),
    ])

    setData({ tickets, invites, expiring, campaigns, commissions })
    setLoading(false)
  }, [orgId, isOwner])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { if (open) loadAll() }, [open, loadAll])

  useEffect(() => {
    const total = data.tickets.length + data.invites.length +
                  data.expiring.length + data.campaigns.length + data.commissions.length
    onCountChange?.(total)
  }, [data, onCountChange])

  if (!open) return null

  // Construir feed unificado, ordenado por relevancia
  const feed = [
    ...data.commissions.map(c => ({
      key:     `comm-${c.id}`,
      icon:    DollarSign,
      color:   'text-rose-400',
      bg:      'bg-rose-500/10',
      title:   `Comisión fuera de rango — ${c.seller?.full_name ?? c.contact?.name ?? '?'}`,
      sub:     `${c.commission_pct}% · ${c.proposal?.client_name ?? '—'}`,
      route:   '/app/campaigns',
      badge:   '⚠ Revisar',
      badgeColor: 'text-rose-400',
    })),
    ...data.invites.map(p => ({
      key:     `inv-${p.id}`,
      icon:    UserPlus,
      color:   'text-brand',
      bg:      'bg-brand/10',
      title:   `${p.full_name || 'Usuario'} esperando activación`,
      sub:     `${p.role} · ${timeAgo(p.created_at)}`,
      route:   '/app/team',
      badge:   'Pendiente',
      badgeColor: 'text-amber-400',
    })),
    ...data.expiring.map(inv => ({
      key:     `perm-${inv.id}`,
      icon:    AlertTriangle,
      color:   'text-amber-400',
      bg:      'bg-amber-500/10',
      title:   `Permiso por vencer — ${inv.name}`,
      sub:     `${inv.code ?? ''} · vence ${fmtDate(inv.permit_expiry)}`,
      route:   '/app/inventory',
      badge:   fmtDate(inv.permit_expiry),
      badgeColor: 'text-amber-400',
    })),
    ...data.campaigns.map(c => ({
      key:     `camp-${c.id}`,
      icon:    Calendar,
      color:   'text-slate-400',
      bg:      'bg-slate-500/10',
      title:   `Campaña vencida — ${c.client_name ?? c.title}`,
      sub:     c.title ?? '',
      route:   '/app/campaigns',
      badge:   `venció ${fmtDate(c.end_date)}`,
      badgeColor: 'text-slate-500',
    })),
    ...data.tickets.map(t => ({
      key:     `tick-${t.id}`,
      icon:    MessageCircle,
      color:   'text-blue-400',
      bg:      'bg-blue-500/10',
      title:   t.subject,
      sub:     `${t.priority ?? 'normal'} · ${timeAgo(t.created_at)}`,
      route:   '/app/support',
      badge:   t.status,
      badgeColor: 'text-slate-500',
    })),
  ]

  const TABS = [
    { key: 'all',         label: 'Todo',       count: feed.length },
    { key: 'tickets',     label: 'Tickets',    count: data.tickets.length },
    { key: 'invites',     label: 'Invites',    count: data.invites.length },
    { key: 'expiring',    label: 'Permisos',   count: data.expiring.length },
    { key: 'campaigns',   label: 'Campañas',   count: data.campaigns.length },
    ...(isOwner ? [{ key: 'commissions', label: 'Comisiones', count: data.commissions.length }] : []),
  ]

  const filtered = activeTab === 'all' ? feed.slice(0, 8) : {
    tickets:     feed.filter(f => f.key.startsWith('tick')),
    invites:     feed.filter(f => f.key.startsWith('inv')),
    expiring:    feed.filter(f => f.key.startsWith('perm')),
    campaigns:   feed.filter(f => f.key.startsWith('camp')),
    commissions: feed.filter(f => f.key.startsWith('comm')),
  }[activeTab] ?? []

  const total = feed.length

  return (
    <div
      className="absolute right-0 top-full mt-1.5 w-96 rounded-xl border border-surface-700 bg-surface-800 shadow-2xl z-50 overflow-hidden animate-fade-in"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-white">Notificaciones</h3>
          {total > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </div>
        <button onClick={loadAll} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-2 pt-2 pb-0 overflow-x-auto border-b border-surface-700">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`shrink-0 rounded-t-md px-3 py-1.5 text-[11px] font-medium transition-colors relative ${
              activeTab === t.key
                ? 'text-brand bg-brand/10 border-b-2 border-brand'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1 rounded-full px-1 text-[9px] font-bold ${
                activeTab === t.key ? 'bg-brand text-white' : 'bg-surface-600 text-slate-400'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Inbox className="h-8 w-8 text-slate-600 mb-2" />
            <p className="text-xs text-slate-500">Sin notificaciones</p>
          </div>
        ) : (
          filtered.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => { onClose?.(); navigate(item.route) }}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-700/50 transition-colors text-left border-b border-surface-700/50 last:border-b-0"
              >
                <div className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg mt-0.5 ${item.bg}`}>
                  <Icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 leading-snug truncate">{item.title}</p>
                  {item.sub && <p className="text-xs text-slate-500 mt-0.5 truncate">{item.sub}</p>}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1 mt-0.5">
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                  {item.badge && (
                    <span className={`text-[9px] font-semibold uppercase tracking-wide ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Footer */}
      {activeTab === 'all' && feed.length > 8 && (
        <div className="border-t border-surface-700 px-4 py-2 text-center">
          <button
            onClick={() => setActive('tickets')}
            className="text-xs text-brand hover:text-brand/80 transition-colors"
          >
            Ver las {feed.length - 8} restantes
          </button>
        </div>
      )}
    </div>
  )
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 1)   return 'ahora'
  if (mins < 60)  return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30)  return `hace ${days} d`
  const months = Math.floor(days / 30)
  return `hace ${months} m`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function NotificationDropdown({ open, onClose, onCountChange }) {
  const { profile, org, isOwner } = useAuth()
  const navigate = useNavigate()
  const orgId = profile?.org_id ?? null

  const [data, setData]         = useState(EMPTY)
  const [activeTab, setActive]  = useState('tickets')
  const [loading, setLoading]   = useState(false)

  const loadAll = useCallback(async () => {
    if (!orgId) return
    setLoading(true)

    const nowIso     = new Date().toISOString()
    const in90Days   = new Date(Date.now() + 90 * 86_400_000).toISOString()

    // Each query handles its own errors so one broken table/column doesn't
    // kill the whole dropdown. permit_expiry in particular is not declared
    // in any repo SQL — if the column doesn't exist in the live DB, the
    // query errors and we just show an empty Permisos tab.
    const [tickets, invites, expiring, campaigns, commissions] = await Promise.all([
      supabase
        .from('support_tickets')
        .select('id, subject, status, priority, created_at')
        .eq('org_id', orgId)
        .neq('status', 'resolved')
        .neq('status', 'closed')
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data, error }) => {
          if (error) { console.warn('[notif] tickets query failed:', error.message); return [] }
          return data ?? []
        }),

      supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .eq('org_id', orgId)
        .eq('is_active', false)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data, error }) => {
          if (error) { console.warn('[notif] invites query failed:', error.message); return [] }
          return data ?? []
        }),

      supabase
        .from('inventory')
        .select('id, name, code, permit_expiry')
        .eq('org_id', orgId)
        .gte('permit_expiry', nowIso)
        .lte('permit_expiry', in90Days)
        .order('permit_expiry', { ascending: true })
        .limit(20)
        .then(({ data, error }) => {
          if (error) { console.warn('[notif] expiring permits query failed:', error.message); return [] }
          return data ?? []
        }),

      supabase
        .from('campaigns')
        .select('id, name, client_name, end_date, status')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .lt('end_date', nowIso.slice(0, 10))
        .order('end_date', { ascending: true })
        .limit(20)
        .then(({ data, error }) => {
          if (error) { console.warn('[notif] campaigns-to-close query failed:', error.message); return [] }
          return data ?? []
        }),

      // Comisiones fuera de rango — solo owner
      isOwner
        ? supabase
            .from('campaign_commissions')
            .select(`
              id, commission_type, commission_pct,
              proposal:proposals(id, title, client_name),
              seller:profiles!beneficiary_profile_id(id, full_name, commission_pct),
              contact:contacts!beneficiary_contact_id(id, name)
            `)
            .eq('org_id', orgId)
            .not('commission_pct', 'is', null)
            .order('created_at', { ascending: false })
            .limit(100)
            .then(({ data, error }) => {
              if (error) { console.warn('[notif] commissions query failed:', error.message); return [] }
              return (data ?? []).filter(c => {
                const registeredPct = Number(c.commission_pct) || 0
                if (c.commission_type === 'internal_seller' && c.seller) {
                  // Alerta si supera el % acordado en el perfil del vendedor
                  const profilePct = Number(c.seller.commission_pct) || 0
                  return profilePct > 0 && registeredPct > profilePct
                }
                // Facilitadores externos/ocultos: alerta si supera 20%
                return registeredPct > 20
              })
            })
        : Promise.resolve([]),
    ])

    setData({ tickets, invites, expiring, campaigns, commissions })
    setLoading(false)
  }, [orgId])

  // Fetch once on mount (so badge is populated before user opens the panel).
  useEffect(() => { loadAll() }, [loadAll])

  // Refetch each time the panel opens — user expects freshness.
  useEffect(() => { if (open) loadAll() }, [open, loadAll])

  // Surface total count to parent for the bell badge.
  useEffect(() => {
    const total = data.tickets.length + data.invites.length + data.expiring.length + data.campaigns.length + data.commissions.length
    onCountChange?.(total)
  }, [data, onCountChange])

  if (!open) return null

  const counts = {
    tickets:     data.tickets.length,
    invites:     data.invites.length,
    expiring:    data.expiring.length,
    campaigns:   data.campaigns.length,
    commissions: data.commissions.length,
  }

  const visibleTabs = TABS.filter(t => !t.ownerOnly || isOwner)

  function handleItemClick(route) {
    onClose?.()
    navigate(route)
  }

  return (
    <div
      className="absolute right-0 top-full mt-1.5 w-96 rounded-xl border border-surface-700 bg-surface-800 shadow-2xl z-50 overflow-hidden animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
        <h3 className="text-sm font-semibold text-white">Notificaciones</h3>
        <button
          onClick={() => navigate(TABS.find(t => t.key === activeTab).route)}
          className="text-xs text-brand hover:text-brand/80 transition-colors flex items-center gap-0.5"
        >
          Ver todo <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-700 bg-surface-900/50">
        {visibleTabs.map(({ key, label, icon: Icon }) => {
          const count  = counts[key]
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 text-[11px] font-medium transition-colors relative ${
                isActive ? 'text-brand' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className="relative">
                <Icon className="h-4 w-4" />
                {count > 0 && (
                  <span className={`absolute -top-1 -right-2 min-w-[14px] h-[14px] rounded-full px-1 text-[9px] font-bold flex items-center justify-center ${
                    isActive ? 'bg-brand text-white' : 'bg-red-500 text-white'
                  }`}>
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </div>
              <span>{label}</span>
              {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />}
            </button>
          )
        })}
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500">Cargando…</div>
        ) : (
          <>
            {activeTab === 'tickets' && (
              counts.tickets === 0 ? <EmptyState label="Sin tickets abiertos" />
              : data.tickets.map(t => (
                  <ListItem
                    key={t.id}
                    title={t.subject}
                    subtitle={`${t.priority ?? 'normal'} · ${timeAgo(t.created_at)}`}
                    meta={t.status}
                    onClick={() => handleItemClick('/app/support')}
                  />
                ))
            )}

            {activeTab === 'invites' && (
              counts.invites === 0 ? <EmptyState label="Sin invitaciones pendientes" />
              : data.invites.map(p => (
                  <ListItem
                    key={p.id}
                    title={p.full_name || 'Usuario sin nombre'}
                    subtitle={`${p.role} · invitado ${timeAgo(p.created_at)}`}
                    meta="Pendiente"
                    onClick={() => handleItemClick('/app/team')}
                  />
                ))
            )}

            {activeTab === 'expiring' && (
              counts.expiring === 0 ? <EmptyState label="Sin permisos por vencer en 90 días" />
              : data.expiring.map(inv => (
                  <ListItem
                    key={inv.id}
                    title={inv.name}
                    subtitle={inv.code ?? ''}
                    meta={fmtDate(inv.permit_expiry)}
                    onClick={() => handleItemClick('/app/inventory')}
                  />
                ))
            )}

            {activeTab === 'campaigns' && (
              counts.campaigns === 0 ? <EmptyState label="Sin campañas por cerrar" />
              : data.campaigns.map(c => (
                  <ListItem
                    key={c.id}
                    title={c.name}
                    subtitle={c.client_name}
                    meta={`Venció ${fmtDate(c.end_date)}`}
                    onClick={() => handleItemClick('/app/campaigns')}
                  />
                ))
            )}

            {activeTab === 'commissions' && isOwner && (
              counts.commissions === 0
                ? <EmptyState label="Sin comisiones fuera de rango" />
                : data.commissions.map(c => {
                    const name = c.seller?.full_name ?? c.contact?.name ?? '(encubierta)'
                    const type = c.commission_type === 'internal_seller' ? 'Vendedor' : 'Facilitador'
                    const prop = c.proposal?.title ?? c.proposal?.client_name ?? '—'
                    return (
                      <ListItem
                        key={c.id}
                        title={`⚠ ${name} — ${c.commission_pct}%`}
                        subtitle={`${type} · ${prop}`}
                        meta="Fuera de rango"
                        metaColor="text-rose-400"
                        onClick={() => handleItemClick('/app/campaigns')}
                      />
                    )
                  })
            )}
          </>
        )}
      </div>
    </div>
  )
}
