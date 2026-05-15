/**
 * useConversation — loads + persists chat history for a user.
 *
 * On user switch:
 *   1. Fetch the persisted conversation from the backend.
 *   2. Render the full prior thread so the assistant "remembers" context.
 *
 * On send():
 *   1. Optimistic-append the user turn locally.
 *   2. POST /chat — the backend writes both turns to shared memory.
 *   3. Append the assistant reply with metadata (intent, badges, docs).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

const toMessage = (m) => ({
  id: m.id,
  role: m.role,
  content: m.content,
  timestamp: m.timestamp,
  intent: m.intent,
  access_denied: m.access_denied,
  memory_updated: m.memory_updated,
})

export function useConversation(currentUser, { onContextUpdate, onMemoryUpdate } = {}) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading]   = useState(false)
  const [sending, setSending]   = useState(false)
  const [error, setError]       = useState(null)
  const lastUserRef = useRef(null)

  // Load persisted history when user changes
  useEffect(() => {
    if (!currentUser) {
      setMessages([])
      return
    }
    if (lastUserRef.current === currentUser.user_id) return
    lastUserRef.current = currentUser.user_id

    let cancelled = false
    setLoading(true)
    setError(null)

    api.getConversation(currentUser.user_id)
      .then((data) => {
        if (cancelled) return
        setMessages((data?.messages || []).map(toMessage))
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message)
        setMessages([])
      })
      .finally(() => !cancelled && setLoading(false))

    return () => { cancelled = true }
  }, [currentUser])

  const send = useCallback(async (text) => {
    const msg = (text || '').trim()
    if (!msg || !currentUser || sending) return

    const userMsg = {
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)
    setError(null)

    try {
      const res = await api.chat(currentUser.user_id, msg, [], true)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.response,
        intent: res.intent,
        access_denied: res.access_denied,
        memory_updated: res.memory_updated,
        timestamp: new Date().toISOString(),
      }])
      onContextUpdate?.(res.retrieved_context || [])
      if (res.memory_updated) onMemoryUpdate?.()
    } catch (err) {
      setError(err.message)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}`,
        access_denied: true,
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setSending(false)
    }
  }, [currentUser, sending, onContextUpdate, onMemoryUpdate])

  const clear = useCallback(async () => {
    if (!currentUser) return
    try {
      await api.clearConversation(currentUser.user_id)
      setMessages([])
      onContextUpdate?.([])
    } catch (e) {
      setError(e.message)
    }
  }, [currentUser, onContextUpdate])

  return { messages, loading, sending, error, send, clear }
}
