import { useState, useEffect, useCallback } from 'react'
import theme from './theme/theme.config'
import Chat from './components/Chat'
import MemoryPanel from './components/MemoryPanel'
import ContextPanel from './components/ContextPanel'
import { api } from './api/client'

function applyTheme(t) {
  const r = document.documentElement
  const c = t.colors
  r.style.setProperty('--bg',                 c.bg)
  r.style.setProperty('--surface',            c.surface)
  r.style.setProperty('--surface2',           c.surface2)
  r.style.setProperty('--surface3',           c.surface3)
  r.style.setProperty('--border',             c.border)
  r.style.setProperty('--border-hover',       c.borderHover)
  r.style.setProperty('--accent',             c.accent)
  r.style.setProperty('--accent-dim',         c.accentDim)
  r.style.setProperty('--accent-text',        c.accentText)
  r.style.setProperty('--gold',               c.gold)
  r.style.setProperty('--gold-dim',           c.goldDim)
  r.style.setProperty('--success',            c.success)
  r.style.setProperty('--danger',             c.danger)
  r.style.setProperty('--warning',            c.warning)
  r.style.setProperty('--text',               c.text)
  r.style.setProperty('--muted',              c.muted)
  r.style.setProperty('--faint',              c.faint)
  r.style.setProperty('--admin-grad',         c.adminGrad)
  r.style.setProperty('--agent-grad',         c.agentGrad)
  r.style.setProperty('--topbar-bg',          t.topbarBg)
  r.style.setProperty('--topbar-border',      t.topbarBorder)
  r.style.setProperty('--user-bubble-bg',     t.userBubbleBg)
  r.style.setProperty('--user-bubble-text',   t.userBubbleText)
  r.style.setProperty('--active-card-bg',     t.activeCardBg)
  r.style.setProperty('--active-card-border', t.activeCardBorder)
  document.title = `${t.productName} — ${t.bankName}`
}

applyTheme(theme)

// ── User Switcher dropdown ─────────────────────────────────────────────────────
function UserSwitcher({ users, currentUser, onSelect }) {
  const [open, setOpen] = useState(false)
  const list = users ? Object.values(users) : []

  const label = (role) => role === 'super_admin' ? 'Super Admin' : 'Agent'
  const icon  = (role) => role === 'super_admin' ? '👑' : '🧑‍💼'

  return (
    <div className="user-sw">
      <button className="user-sw-btn" onClick={() => setOpen(o => !o)}>
        <div className={`sw-av ${currentUser?.role ?? 'none'}`}>
          {currentUser ? icon(currentUser.role) : '👤'}
        </div>
        <div className="sw-info">
          <span className="sw-name">{currentUser?.name ?? 'Select User'}</span>
          <span className="sw-role">
            {currentUser ? label(currentUser.role) : 'Choose a role to begin'}
          </span>
        </div>
        <span className="sw-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <>
          <div className="sw-backdrop" onClick={() => setOpen(false)} />
          <div className="sw-menu">
            <div className="sw-menu-hd">Switch User</div>
            {list.length === 0 && (
              <div className="sw-loading">Loading users…</div>
            )}
            {list.map(u => (
              <div
                key={u.user_id}
                className={`sw-opt ${currentUser?.user_id === u.user_id ? 'active' : ''}`}
                onClick={() => { onSelect(u); setOpen(false) }}
              >
                <div className={`sw-opt-av ${u.role}`}>{icon(u.role)}</div>
                <div className="sw-opt-body">
                  <span className="sw-opt-name">{u.name}</span>
                  <span className={`sw-opt-badge ${u.role}`}>{label(u.role)}</span>
                </div>
                {currentUser?.user_id === u.user_id && (
                  <span className="sw-check">✓</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [users, setUsers]           = useState(null)
  const [currentUser, setUser]      = useState(null)
  const [contextDocs, setDocs]      = useState([])
  const [rightTab, setRightTab]     = useState('context')
  const [memRefresh, setMemRefresh] = useState(0)

  useEffect(() => { api.getUsers().then(setUsers).catch(console.error) }, [])

  const selectUser  = useCallback((u) => { setUser(u); setDocs([]) }, [])
  const onMemUpdate = useCallback(() => {
    setMemRefresh(n => n + 1)
    setRightTab('memory')
  }, [])

  return (
    <div className="shell">

      {/* ── Header ── */}
      <header className="topbar">
        <div className="topbar-brand">
          {/* J.P. Morgan logo — SVG octagon + serif text */}
          <div className="jpm-logo-wrap">
            <svg className="jpm-logo-svg" viewBox="0 0 48 48" fill="none">
              <polygon points="14,2 34,2 46,14 46,34 34,46 14,46 2,34 2,14" fill="#0078CF"/>
              <line x1="14" y1="2"  x2="34" y2="46" stroke="white" strokeWidth="2.6"/>
              <line x1="46" y1="14" x2="2"  y2="34" stroke="white" strokeWidth="2.6"/>
            </svg>
            <span className="jpm-logo-text">{theme.logoText}</span>
          </div>

          <div className="topbar-divider" />

          <div className="topbar-title-wrap">
            <div className="t-title">{theme.productName}</div>
            <div className="t-sub">{theme.tagline}</div>
          </div>
        </div>

        <div className="spacer" />

        <UserSwitcher users={users} currentUser={currentUser} onSelect={selectUser} />
      </header>

      {/* JPM blue accent stripe under header */}
      <div className="brand-stripe" />

      {/* ── Main ── */}
      <div className="main">

        {/* Chat — full centre */}
        <div className="chat-area">
          <Chat
            currentUser={currentUser}
            bankName={theme.bankName}
            onContextUpdate={setDocs}
            onMemoryUpdate={onMemUpdate}
          />
        </div>

        {/* Right info panel */}
        <aside className="rpanel">
          <div className="p-tabs">
            <button
              className={`p-tab ${rightTab === 'context' ? 'active' : ''}`}
              onClick={() => setRightTab('context')}
            >
              RAG Context
            </button>
            <button
              className={`p-tab ${rightTab === 'memory' ? 'active' : ''}`}
              onClick={() => setRightTab('memory')}
            >
              Memory
            </button>
          </div>

          <div className="p-header">
            {rightTab === 'context'
              ? `Retrieved Docs (${contextDocs.length})`
              : 'Long-term Memory'}
          </div>

          <div className="p-scroll">
            {rightTab === 'context'
              ? <ContextPanel docs={contextDocs} />
              : <MemoryPanel
                  currentUser={currentUser}
                  key={`${currentUser?.user_id}-${memRefresh}`}
                />}
          </div>
        </aside>

      </div>
    </div>
  )
}
