import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/appStore'

export function useAuth() {
  const { user, userRole, setUser, setUserRole, clearUser } = useAppStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        setUserRole(session.user.user_metadata?.role || 'va')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setUserRole(session.user.user_metadata?.role || 'va')
      } else {
        clearUser()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    clearUser()
  }

  return { user, userRole, signIn, signOut }
}
