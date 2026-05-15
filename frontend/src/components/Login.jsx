import { useState } from 'react'
import theme from '../theme/theme.config'

const DEMO = [
  { label: 'Super Admin', user: 'super_admin', pwd: 'admin123' },
  { label: 'Employee 1',  user: 'emp_1',       pwd: 'emp123'   },
  { label: 'Employee 2',  user: 'emp_2',       pwd: 'emp234'   },
]

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!username || !password || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onLogin(username.trim(), password)
    } catch (err) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setSubmitting(false)
    }
  }

  const quickFill = (creds) => {
    setUsername(creds.user)
    setPassword(creds.pwd)
    setError(null)
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <svg className="jpm-logo-svg" viewBox="0 0 48 48" fill="none" aria-hidden>
            <polygon points="14,2 34,2 46,14 46,34 34,46 14,46 2,34 2,14" fill="#0078CF" />
            <line x1="14" y1="2"  x2="34" y2="46" stroke="white" strokeWidth="2.6" />
            <line x1="46" y1="14" x2="2"  y2="34" stroke="white" strokeWidth="2.6" />
          </svg>
          <div className="login-brand-text">
            <div className="login-brand-bank">{theme.bankName}</div>
            <div className="login-brand-product">{theme.productName}</div>
          </div>
        </div>

        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">Your role and permissions are loaded from your account.</p>

        <form className="login-form" onSubmit={submit}>
          <label className="login-field">
            <span className="login-label">Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. agent_1"
              autoFocus
              disabled={submitting}
            />
          </label>

          <label className="login-field">
            <span className="login-label">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={submitting}
            />
          </label>

          {error && <div className="login-error">⚠ {error}</div>}

          <button
            type="submit"
            className="login-submit"
            disabled={submitting || !username || !password}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-demo">
          <div className="login-demo-label">Demo accounts</div>
          <div className="login-demo-grid">
            {DEMO.map((d) => (
              <button
                type="button"
                key={d.user}
                className="login-demo-btn"
                onClick={() => quickFill(d)}
                disabled={submitting}
              >
                <span className="login-demo-name">{d.label}</span>
                <span className="login-demo-user">{d.user}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="login-footer">{theme.tagline}</footer>
    </div>
  )
}
