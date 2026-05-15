/**
 * useSuggestions — fetches LLM-generated, RBAC-scoped prompt suggestions
 * for the logged-in user.
 *
 * The backend builds these from ONLY the docs/clients this specific user
 * can access, so emp_1 will never see prompts referencing emp_2's clients.
 *
 * Suggestions are cached per user_id in sessionStorage so we don't burn an
 * LLM call on every page navigation.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

const CACHE_PREFIX = 'wealth_suggestions_'
const TTL_MS = 1000 * 60 * 15  // 15 min

function readCache(userId) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + userId)
    if (!raw) return null
    const { ts, suggestions } = JSON.parse(raw)
    if (Date.now() - ts > TTL_MS) return null
    return suggestions
  } catch { return null }
}

function writeCache(userId, suggestions) {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + userId,
      JSON.stringify({ ts: Date.now(), suggestions }),
    )
  } catch { /* ignore */ }
}

export function useSuggestions(user) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const lastUser = useRef(null)

  const load = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setSuggestions([])
      return
    }
    if (!forceRefresh) {
      const cached = readCache(user.user_id)
      if (cached) { setSuggestions(cached); return }
    }
    setLoading(true); setError(null)
    try {
      const res = await api.getSuggestions(user.user_id, 6)
      const list = res?.suggestions || []
      setSuggestions(list)
      writeCache(user.user_id, list)
    } catch (e) {
      setError(e.message)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) { setSuggestions([]); lastUser.current = null; return }
    if (lastUser.current === user.user_id) return
    lastUser.current = user.user_id
    load()
  }, [user, load])

  return { suggestions, loading, error, refresh: () => load(true) }
}
