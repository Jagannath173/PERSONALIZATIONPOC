import { useCallback, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import theme from './theme/theme.config'
import Chat from './components/Chat'
import Sidebar from './components/Sidebar'
import Login from './components/Login'
import SettingsPage from './components/SettingsPage'
import { useAuth } from './hooks/useAuth'
import { useConversation } from './hooks/useConversation'
import { usePreferences } from './hooks/usePreferences'

function applyTheme(t) {
  const r = document.documentElement
  const c = t.colors
  const set = (k, v) => r.style.setProperty(k, v)
  set('--bg', c.bg);                 set('--surface', c.surface)
  set('--surface2', c.surface2);     set('--surface3', c.surface3)
  set('--border', c.border);         set('--border-hover', c.borderHover)
  set('--accent', c.accent);         set('--accent-dim', c.accentDim)
  set('--accent-text', c.accentText);set('--gold', c.gold)
  set('--gold-dim', c.goldDim);      set('--success', c.success)
  set('--danger', c.danger);         set('--warning', c.warning)
  set('--text', c.text);             set('--muted', c.muted)
  set('--faint', c.faint);           set('--admin-grad', c.adminGrad)
  set('--agent-grad', c.agentGrad);  set('--topbar-bg', t.topbarBg)
  set('--topbar-border', t.topbarBorder)
  set('--user-bubble-bg', t.userBubbleBg)
  set('--user-bubble-text', t.userBubbleText)
  set('--active-card-bg', t.activeCardBg)
  set('--active-card-border', t.activeCardBorder)
  document.title = `${t.productName} — ${t.bankName}`
}
applyTheme(theme)

const initials = (name) =>
  (name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
const roleLabel = (role) => (role === 'super_admin' ? 'Super Admin' : 'Employee')

function IdentityCard({ user, onClick }) {
  return (
    <button
      type="button"
      className="identity identity-btn"
      onClick={onClick}
      aria-label="Open settings"
      title="Settings"
    >
      <div className={`identity-av ${user.role}`}>{initials(user.name)}</div>
      <div className="identity-body">
        <span className="identity-name">{user.name}</span>
        <span className={`identity-role ${user.role}`}>{roleLabel(user.role)}</span>
      </div>
      <svg className="identity-chev" viewBox="0 0 24 24" width="14" height="14"
           fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}

function TopBar({ user, onIdentityClick, onLogoClick }) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-brand">
          <button
            type="button"
            className="jpm-logo-wrap jpm-logo-btn"
            onClick={onLogoClick}
            aria-label="Go to home"
            title="Home"
          >
            <svg className="jpm-logo-svg" viewBox="0 0 48 48" fill="none" aria-hidden>
              <polygon points="14,2 34,2 46,14 46,34 34,46 14,46 2,34 2,14" fill="#0078CF" />
              <line x1="14" y1="2"  x2="34" y2="46" stroke="white" strokeWidth="2.6" />
              <line x1="46" y1="14" x2="2"  y2="34" stroke="white" strokeWidth="2.6" />
            </svg>
            <span className="jpm-logo-text">{theme.logoText}</span>
          </button>

          <div className="topbar-divider" />

          <div className="topbar-title-wrap">
            <div className="t-title">{theme.productName}</div>
            <div className="t-sub">{theme.tagline}</div>
          </div>
        </div>

        <div className="spacer" />

        {user && <IdentityCard user={user} onClick={onIdentityClick} />}
      </header>
      <div className="brand-stripe" />
    </>
  )
}

function ChatRoute({ user, conversation, openSettings, handleLogout }) {
  return (
    <div className="main">
      <Sidebar
        user={user}
        conversation={conversation}
        onOpenSettings={openSettings}
        onLogout={handleLogout}
      />
      <main className="chat-area chat-area-full">
        <Chat
          currentUser={user}
          bankName={theme.bankName}
          conversation={conversation}
          onOpenSettings={openSettings}
        />
      </main>
    </div>
  )
}

function RequireAuth({ user, children }) {
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}

export default function App() {
  const { user, loading, login, logout, updateProfile } = useAuth()
  usePreferences()

  const navigate = useNavigate()
  const location = useLocation()

  const [contextDocs, setDocs]      = useState([])
  const [memRefresh, setMemRefresh] = useState(0)

  const onMemoryUpdate = useCallback(() => {
    setMemRefresh((n) => n + 1)
  }, [])

  const onContextUpdate = useCallback((docs) => {
    setDocs(docs)
  }, [])

  const conversation = useConversation(user, { onContextUpdate, onMemoryUpdate })

  const handleLogout = useCallback(() => {
    setDocs([])
    logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  const openSettings = useCallback((tab) => {
    navigate(tab ? `/settings/${tab}` : '/settings')
  }, [navigate])

  const handleLogin = useCallback(async (...args) => {
    const result = await login(...args)
    navigate('/', { replace: true })
    return result
  }, [login, navigate])

  if (loading) {
    return <div className="boot-screen"><div className="boot-spinner" /></div>
  }

  const onLoginRoute = location.pathname.startsWith('/login')

  return (
    <div className="shell">
      {!onLoginRoute && (
        <TopBar
          user={user}
          onIdentityClick={() => openSettings('general')}
          onLogoClick={() => navigate('/')}
        />
      )}

      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />}
        />

        <Route
          path="/"
          element={
            <RequireAuth user={user}>
              <ChatRoute
                user={user}
                conversation={conversation}
                openSettings={openSettings}
                handleLogout={handleLogout}
              />
            </RequireAuth>
          }
        />

        <Route
          path="/settings"
          element={
            <RequireAuth user={user}>
              <SettingsPage
                user={user}
                contextDocs={contextDocs}
                memoryRefreshKey={memRefresh}
                updateProfile={updateProfile}
                onLogout={handleLogout}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/settings/:section"
          element={
            <RequireAuth user={user}>
              <SettingsPage
                user={user}
                contextDocs={contextDocs}
                memoryRefreshKey={memRefresh}
                updateProfile={updateProfile}
                onLogout={handleLogout}
              />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </div>
  )
}
