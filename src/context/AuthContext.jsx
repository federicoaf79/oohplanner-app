import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]     = useState(undefined) // undefined = loading
  const [profile, setProfile]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  // Tracks whether the current sign-out was user-initiated, so we can
  // distinguish it from an automatic sign-out caused by token expiry.
  const intentionalSignOut = useRef(false)

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, organisations(id, name, slug, logo_url, plan, max_discount_salesperson, max_discount_manager)')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error.message)
      return null
    }
    return data
  }

  useEffect(() => {
    let cancelled = false

    // ── 1. getSession() como fuente primaria del estado inicial ──
    // onAuthStateChange no siempre dispara INITIAL_SESSION en todos los
    // navegadores/entornos, dejando loading=true indefinidamente.
    // getSession() siempre resuelve y es la forma confiable de arrancar.
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (cancelled) return

      if (error || !session) {
        // Sin sesión o expirada → limpiar estado y resolver loading
        setSession(null)
        setProfile(null)
        setLoading(false)
        return
      }

      setSession(session)
      const p = await fetchProfile(session.user.id)
      if (!cancelled) {
        setProfile(p)
        setLoading(false)
      }
    })

    // ── 2. Timeout de 5s como último recurso ──────────────────
    // Si getSession() nunca resuelve (red offline, error inesperado),
    // forzamos loading=false para no dejar la app bloqueada.
    const timeout = setTimeout(() => {
      setLoading(false)
    }, 5000)

    // ── 3. onAuthStateChange solo para eventos posteriores ────
    // Ignoramos INITIAL_SESSION porque ya lo manejamos con getSession().
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Ya resuelto por getSession() — evitar doble fetch de perfil
        if (event === 'INITIAL_SESSION') return

        setSession(session)

        if (event === 'TOKEN_REFRESHED') {
          setLoading(false)
          return
        }

        if (event === 'SIGNED_OUT') {
          setProfile(null)
          if (!intentionalSignOut.current) {
            setSessionExpired(true)
          }
          intentionalSignOut.current = false
          setLoading(false)
          return
        }

        // SIGNED_IN, USER_UPDATED — refetch perfil
        if (session?.user) {
          const p = await fetchProfile(session.user.id)
          if (!cancelled) setProfile(p)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signUp({ email, password, fullName, orgName }) {
    // El trigger handle_new_user (SECURITY DEFINER) crea la org y el perfil
    // automáticamente al detectar `org_name` en los metadatos.
    // No hay inserción directa del cliente en `organisations` → sin problemas de RLS.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          org_name:  orgName,
        },
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

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    sessionExpired,
    role: profile?.role ?? null,
    org: profile?.organisations ?? null,
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
