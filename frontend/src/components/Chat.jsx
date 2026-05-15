import { useEffect, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'
import { useSuggestions } from '../hooks/useSuggestions'

export default function Chat({
  currentUser,
  bankName,
  conversation,
  onOpenSettings,
}) {
  const { messages, loading, sending, error, send } = conversation

  const { suggestions, loading: sLoading, refresh: refreshSuggestions } =
    useSuggestions(currentUser)

  const DEFAULT_SUGGESTIONS = [
    'Give me an overview of my client portfolio.',
    'Which of my clients need a follow-up this week?',
    'Summarize recent interactions with my top clients.',
    'What action items are pending across my accounts?',
    'Show me clients with the highest risk exposure.',
    'Draft a check-in note for a client I haven’t spoken to lately.',
  ]
  const displayedSuggestions = suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS

  const [input, setInput] = useState('')
  const [lastDocCount, setLastDocCount] = useState(0)
  const endRef   = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])
  useEffect(() => { inputRef.current?.focus() }, [currentUser])

  const submit = (text) => {
    const msg = text ?? input
    if (!msg?.trim()) return
    send(msg)
    setInput('')
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const hasHistory = messages.length > 0

  // Track how many docs the last assistant turn retrieved (for the ribbon chip)
  useEffect(() => {
    if (!hasHistory) return
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistant) return
    // useConversation surfaces docs via onContextUpdate — we can't read here,
    // so we track length passively via a separate prop if needed. For now,
    // expose the indicator only when the right panel is in use.
  }, [messages, hasHistory])

  if (!currentUser) {
    return (
      <div className="chat-empty">
        <div className="welcome-banner">
          <div className="welcome-icon" aria-hidden>🔐</div>
          <div className="welcome-title">{bankName || 'Wealth Assistant'}</div>
          <div className="welcome-sub">Sign in to start a secure session.</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="chat-msgs">
        {loading && (
          <div className="chat-skeleton" aria-busy="true">
            <div className="skeleton-line w-60" />
            <div className="skeleton-line w-80" />
            <div className="skeleton-line w-40" />
          </div>
        )}

        {!loading && !hasHistory && (
          <div className="welcome-stack">
            <div className="welcome-banner">
              <div className="welcome-icon" aria-hidden>💬</div>
              <div className="welcome-title">Hello, {currentUser.name}</div>
              <div className="welcome-sub">
                I remember our prior conversations and can only see data within your access scope.
                Pick a suggestion below or ask anything.
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={m.id || i} message={m} currentUser={currentUser} />
        ))}

        {sending && (
          <div className="msg-row assistant">
            <div className="msg-av assistant" aria-hidden>AI</div>
            <div className="msg-bubble typing">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="input-area">
        {!loading && !input.trim() && (
          <div className="suggestions">
            <div className="suggestions-hd">
              <span>{hasHistory ? 'Try asking' : 'Suggested for you'}</span>
              <button
                type="button"
                className="suggestions-refresh"
                onClick={refreshSuggestions}
                disabled={sLoading || sending}
                title="Regenerate suggestions"
              >
                {sLoading ? 'Generating…' : '↻ refresh'}
              </button>
            </div>

            {sLoading && suggestions.length === 0 ? (
              <div className="suggestions-skeleton">
                <div className="skeleton-pill" />
                <div className="skeleton-pill w-65" />
                <div className="skeleton-pill w-75" />
                <div className="skeleton-pill w-55" />
              </div>
            ) : (
              <div className="quick-wrap">
                {displayedSuggestions.slice(0, 6).map((s, i) => (
                  <button
                    key={`${i}-${s}`}
                    type="button"
                    className="quick-btn"
                    onClick={() => submit(s)}
                    disabled={sending}
                    title={s}
                  >
                    {s.length > 64 ? s.slice(0, 61) + '…' : s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <div className="error-banner">⚠ {error}</div>}

        <div className="input-row">
          <textarea
            ref={inputRef}
            className="input-box"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={`Message as ${currentUser.name}…  (Enter to send · Shift+Enter for newline)`}
            rows={1}
            disabled={sending}
          />
          <button
            type="button"
            className="send-btn"
            onClick={() => submit()}
            disabled={sending || !input.trim()}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                 strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
