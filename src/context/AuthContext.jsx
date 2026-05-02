import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

function applyOrgExpiry(profileData) {
  if (!profileData?.organisations) return profileData
  const org = profileData.organisations
  const isExpired =
    org.subscription_status === 'trial' &&
    org.trial_ends_at != null &&
    new Date(org.trial_ends_at) < new Date()
  return { ...profileData, organisations: { ...org, is_expired: isExpired } }
}

export function AuthProvider({ children }) {
  const [session, setSession]     = useState(undefined) // undefined = loading
  const [profile, setProfile]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const intentionalSignOut  = useRef(false)
  const profileLoadedRef    = useRef(false)
  const initialLoadDone     = useRef(false)  // getSession() completó

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select(`*,
        organisations(
          id, name, slug, logo_url, plan,
          max_discount_salesperson, max_discount_manager,
          trial_ends_at, subscription_status, plan_price_usd,
          office_address, office_phone, office_hours, website,
          billing_cuit, billing_razon_social, billing_contact,
          billing_phone, billing_address, billing_email, notes,
          artwork_h_url, artwork_v_url, artwork_sq_url,
          has_internal_designer, internal_designer_price_per_billboard,
          external_designer_cost_per_hour, external_designer_markup_pct,
          external_designer_default_hours,
          colocacion_cost_per_m2, colocacion_markup_pct,
          impresion_cost_per_m2, impresion_markup_pct,
          sellers_see_own_commission, manager_permissions
        )
      `)
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error.message)
      return null
    }
    return applyOrgExpiry(data)
  }

  useEffect(() => {
    // Timeout de seguridad: si en 8 segundos no termina, desbloquea la app
    const safetyTimeout = setTimeout(() => {
      if (!initialLoadDone.current) {
        console.warn('AuthContext: safety timeout triggered')
        initialLoadDone.current = true
        setLoading(false)
      }
    }, 8000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)

        if (event === 'TOKEN_REFRESHED') {
          return // no cambiar loading
        }

        if (event === 'SIGNED_OUT') {
          profileLoadedRef.current = false
          initialLoadDone.current  = true
          setProfile(null)
          if (!intentionalSignOut.current) setSessionExpired(true)
          intentionalSignOut.current = false
          setLoading(false)
          return
        }

        if (event === 'INITIAL_SESSION') {
          // Evento más confiable para la carga inicial
          if (session?.user) {
            try {
              const p = await fetchProfile(session.user.id)
              setProfile(p)
              profileLoadedRef.current = true
            } catch (e) {
              console.error('fetchProfile error:', e)
            }
          }
          initialLoadDone.current = true
          clearTimeout(safetyTimeout)
          setLoading(false)
          return
        }

        if (event === 'SIGNED_IN') {
          // Solo fetchear si no hay perfil cargado (login nuevo, no refresh)
          if (!profileLoadedRef.current && session?.user) {
            try {
              const p = await fetchProfile(session.user.id)
              if (p) { setProfile(p); profileLoadedRef.current = true }
            } catch (e) {
              console.error('fetchProfile error on SIGNED_IN:', e)
            }
          }
          if (!initialLoadDone.current) {
            initialLoadDone.current = true
            clearTimeout(safetyTimeout)
            setLoading(false)
          }
          return
        }

        if (event === 'USER_UPDATED' && session?.user) {
          try {
            const p = await fetchProfile(session.user.id)
            setProfile(p)
          } catch {}
          return
        }
      }
    )

    return () => {
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signUp({ email, password, fullName, orgName }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, org_name: orgName },
      },
    })
    return { data, error }
  }

  async function signOut() {
    intentionalSignOut.current = true
    await supabase.auth.signOut()
  }

  async function refreshProfile() {
    if (session?.user) {
      const p = await fetchProfile(session.user.id)
      setProfile(p)
    }
  }

  const org = profile?.organisations ?? null

  // Visibilidad de comisiones / asociados / facilitadores / externos.
  // Field: 'see_site_associates' | 'see_sale_facilitators' |
  //        'see_external_sellers' | 'see_team_commissions'
  function canSeeCommissions(field) {
    const role = profile?.role
    if (role === 'owner') return true
    if (role === 'manager') {
      const perms = org?.manager_permissions
      return !!(perms?.enabled && perms?.[field])
    }
    return false
  }

  const value = {
    session,
    user:          session?.user ?? null,
    profile,
    loading,
    sessionExpired,
    role:          profile?.role ?? null,
    org,
    isExpired:     org?.is_expired ?? false,
    isOwner:       profile?.role === 'owner',
    isManager:     profile?.role === 'manager',
    isSalesperson: profile?.role === 'salesperson',
    canSeeCommissions,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
