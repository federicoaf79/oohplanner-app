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
  const intentionalSignOut  = useRef(false)
  const profileLoadedRef    = useRef(false)

  async function fetchProfile(userId) {
    console.log('fetchProfile llamado para:', userId)
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
    ;(async () => {
      console.log('getSession inicio')
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        console.log('getSession: sesión encontrada', session.user.id)
        setSession(session)
        const p = await fetchProfile(session.user.id)
        setProfile(p)
        profileLoadedRef.current = true
      }
      setLoading(false)
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('authEvent:', event, session?.user?.id)
        setSession(session)

        if (event === 'TOKEN_REFRESHED') {
          // Token silently refreshed — session already updated, no need to
          // re-fetch the profile.
          setLoading(false)
          return
        }

        if (event === 'SIGNED_OUT') {
          profileLoadedRef.current = false
          setProfile(null)
          // If the sign-out wasn't user-initiated (e.g. refresh token expired),
          // flag the session as expired so the login page can show a message.
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
            fetchProfile(session.user.id)
            return currentProfile
          })
          return
        }

        // INITIAL_SESSION, USER_UPDATED — fetch/refresh profile
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
