/**
 * useAuth — minimal session management for the POC.
 *
 *   user           — logged-in user object (or null)
 *   loading        — true on initial localStorage hydrate
 *   login()        — POST credentials, on success persist user
 *   logout()       — clear localStorage and reset state
 *   updateProfile  — PATCH name/email/password on the server, refresh local state
 *   replaceUser    — overwrite the cached user object (used after admin edits)
 *
 * Persistence: `localStorage.wealth_user`. The backend is the authority on
 * credentials; we just keep the public user record client-side so a page
 * reload doesn't bounce the user back to the login screen.
 */

import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

const STORAGE_KEY = 'wealth_user'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setUser(JSON.parse(raw))
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const persist = useCallback((u) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    setUser(u)
  }, [])

  const login = useCallback(async (username, password) => {
    setError(null)
    try {
      const { user: u } = await api.login(username, password)
      persist(u)
      return u
    } catch (e) {
      setError(e.message || 'Login failed')
      throw e
    }
  }, [persist])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (patch) => {
    if (!user) throw new Error('Not signed in')
    const updated = await api.updateProfile(user.user_id, patch)
    persist(updated)
    return updated
  }, [user, persist])

  return { user, loading, error, login, logout, updateProfile, replaceUser: persist }
}
