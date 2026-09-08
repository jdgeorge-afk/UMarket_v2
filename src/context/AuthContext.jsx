import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    // Show cached profile instantly — eliminates the visible delay on every page load
    const cacheKey = `umarket_profile_${userId}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) setProfile(JSON.parse(cached))
    } catch {}

    // Fetch fresh from network in the background
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) {
      setProfile(data)
      try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch {}
      return
    }
    // Profile missing — upsert to ensure FK target exists before any listing inserts
    const { data: created } = await supabase
      .from('profiles')
      .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })
      .select()
      .single()
    if (created) {
      setProfile(created)
      try { localStorage.setItem(cacheKey, JSON.stringify(created)) } catch {}
    } else {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    // Get the current session immediately on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id)
      setLoading(false)
    })

    // Subscribe to future auth changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id)
        // Clean up the token hash from the URL after email confirmation redirect
        if (window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname)
        }
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signUp = async ({ email, password, name, schoolId, userType = 'student', schoolIds = [], companyName = '', companyWebsite = '' }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, school_id: schoolId, user_type: userType, school_ids: schoolIds, company_name: companyName, company_website: companyWebsite },
        emailRedirectTo: window.location.origin,
      },
    })
    return { error }
  }

  const signIn = async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return { error }
  }

  const signOut = async () => {
    if (user) {
      try { localStorage.removeItem(`umarket_profile_${user.id}`) } catch {}
    }
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const resetPassword = async (email) => {
    // IMPORTANT — add this URL to Supabase dashboard:
    // Authentication → URL Configuration → Redirect URLs
    // https://www.u-market.app/reset-password
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.u-market.app/reset-password',
    })
    return { error }
  }

  const updateProfile = async (updates) => {
    if (!user) return { error: new Error('Not authenticated') }
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (!error && data) {
      setProfile(data)
      try { localStorage.setItem(`umarket_profile_${user.id}`, JSON.stringify(data)) } catch {}
    }
    return { data, error }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
        resetPassword,
        updateProfile,
        fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
