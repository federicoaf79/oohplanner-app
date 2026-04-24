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
          impresion_cost_per_m2, impresion_markup_pct
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
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSession(session)
        const p = await fetchProfile(session.user.id)
        setProfile(p)
        profileLoadedRef.current = true
      }
      setLoading(false)
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)

        if (event === 'TOKEN_REFRESHED') {
          setLoading(false)
          return
        }

        if (event === 'SIGNED_OUT') {
          profileLoadedRef.current = false
          setProfile(null)
          if (!intentionalSignOut.current) {
            setSessionExpired(true)
          }
          intentionalSignOut.current = false
          setLoading(false)
          return
        }

        if (event === 'SIGNED_IN') {
          setProfile(currentProfile => {
            if (currentProfile?.id === session.user.id) return currentProfile
            fetchProfile(session.user.id).then(p => { if (p) setProfile(p) })
            return currentProfile
          })
          return
        }

        // INITIAL_SESSION, USER_UPDATED
        if (session?.user) {
          const p = await fetchProfile(session.user.id)
          setProfile(p)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
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
