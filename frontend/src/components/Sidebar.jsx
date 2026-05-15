import { useMemo } from 'react'

function chatTitle(messages) {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return 'New chat'
  const t = (firstUser.content || '').trim().replace(/\s+/g, ' ')
  return t.length > 38 ? t.slice(0, 35) + '…' : t
}

function chatSubtitle(messages) {
  if (messages.length === 0) return 'No prior context'
  const n = messages.length
  return `${n} message${n === 1 ? '' : 's'} remembered`
}

export default function Sidebar({ user, conversation, onOpenSettings, onLogout }) {
  const { messages, clear, sending } = conversation

  const hasHistory = messages.length > 0
  const title = useMemo(() => chatTitle(messages), [messages])
  const subtitle = useMemo(() => chatSubtitle(messages), [messages])

  const onClear = () => {
    if (!hasHistory) return
    if (window.confirm("Clear the assistant's memory of this conversation?")) clear()
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-hd">
        <span className="sidebar-hd-label">Chats</span>
        <button
          type="button"
          className="sidebar-new"
          onClick={onClear}
          disabled={!hasHistory || sending}
          title={hasHistory ? 'Start a new chat (clears memory)' : 'No prior context'}
          aria-label="New chat"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="sidebar-list">
        <button type="button" className="sidebar-chat active" title={title}>
          <div className="sidebar-chat-icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="sidebar-chat-body">
            <span className="sidebar-chat-title">{title}</span>
            <span className="sidebar-chat-sub">{subtitle}</span>
          </div>
        </button>
      </div>

      <div className="sidebar-foot">
        <div className="sidebar-mem">
          <span className="ribbon-dot" aria-hidden />
          <span className="sidebar-mem-label">Shared memory</span>
          <span className="sidebar-mem-sep">·</span>
          <span className="sidebar-mem-meta">
            {hasHistory ? `${messages.length} remembered` : 'No prior context'}
          </span>
        </div>

        <button
          type="button"
          className="sidebar-foot-btn"
          onClick={() => onOpenSettings?.('preferences')}
          title="Open preferences"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
          <span>Preferences</span>
        </button>

        <button
          type="button"
          className="sidebar-foot-btn logout"
          onClick={onLogout}
          title="Log out"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Log out</span>
        </button>

        {user && (
          <div className="sidebar-user" title={user.name}>
            <div className={`sidebar-user-av ${user.role}`}>
              {(user.name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="sidebar-user-body">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-role">
                {user.role === 'super_admin' ? 'Super Admin' : 'Employee'}
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
