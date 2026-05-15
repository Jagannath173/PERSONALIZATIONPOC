import { useEffect, useState } from 'react'
import { FONT_OPTIONS, usePreferences } from '../../hooks/usePreferences'

const roleLabel = (r) => (r === 'super_admin' ? 'Super Admin' : 'Employee')

export default function GeneralSection({ user, updateProfile, onLogout }) {
  const { prefs, update } = usePreferences()

  // Profile editing
  const [name, setName]   = useState(user.name || '')
  const [email, setEmail] = useState(user.email || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [err, setErr]       = useState(null)

  useEffect(() => { setName(user.name || ''); setEmail(user.email || '') }, [user])

  const dirty = name.trim() !== (user.name || '') || email.trim() !== (user.email || '')

  const save = async (e) => {
    e?.preventDefault?.()
    if (!dirty || saving) return
    setSaving(true); setErr(null); setSaved(false)
    try {
      const patch = {}
      if (name.trim() !== user.name)  patch.name  = name.trim()
      if (email.trim() !== user.email) patch.email = email.trim()
      await updateProfile(patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch (e) {
      setErr(e.message)
    } finally { setSaving(false) }
  }

  // Password change
  const [pwOpen, setPwOpen] = useState(false)
  const [pwCur, setPwCur]   = useState('')
  const [pwNew, setPwNew]   = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwErr, setPwErr]   = useState(null)
  const [pwOk, setPwOk]     = useState(false)

  const changePw = async (e) => {
    e?.preventDefault?.()
    if (!pwCur || !pwNew || pwSaving) return
    setPwSaving(true); setPwErr(null); setPwOk(false)
    try {
      await updateProfile({ current_password: pwCur, new_password: pwNew })
      setPwOk(true); setPwCur(''); setPwNew('')
      setTimeout(() => setPwOk(false), 2200)
    } catch (e) { setPwErr(e.message) }
    finally { setPwSaving(false) }
  }

  const initials = (user.name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      {/* ── Profile ── */}
      <h2 className="settings-h">Profile</h2>

      <form onSubmit={save} className="settings-card">
        <div className="settings-row">
          <label className="settings-row-label">Avatar</label>
          <div className={`settings-row-value`}>
            <div className={`profile-avatar-lg ${user.role}`}>{initials}</div>
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-row-label" htmlFor="full-name">Full name</label>
          <div className="settings-row-value">
            <input
              id="full-name"
              type="text"
              className="settings-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-row-label" htmlFor="email">Email</label>
          <div className="settings-row-value">
            <input
              id="email"
              type="email"
              className="settings-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-row-label">User ID</label>
          <div className="settings-row-value">
            <code className="settings-static-pill">{user.user_id}</code>
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-row-label">Role</label>
          <div className="settings-row-value">
            <span className={`role-pill ${user.role}`}>{roleLabel(user.role)}</span>
          </div>
        </div>

        {user.role === 'employee' && (
          <div className="settings-row">
            <label className="settings-row-label">Assigned clients</label>
            <div className="settings-row-value">
              <div className="settings-tag-row">
                {(user.assigned_clients || []).length === 0
                  ? <span className="settings-muted">None assigned</span>
                  : (user.assigned_clients || []).map((c) => (
                      <span key={c} className="settings-tag">{c.replace(/^client_/, '')}</span>
                    ))}
              </div>
            </div>
          </div>
        )}

        {err && <div className="settings-error">⚠ {err}</div>}

        <div className="settings-row-actions">
          {saved && <span className="settings-saved">✓ Saved</span>}
          <button
            type="submit"
            className="settings-btn primary"
            disabled={!dirty || saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      {/* ── Display / font ── */}
      <h2 className="settings-h">Display</h2>
      <div className="settings-card">
        <div className="settings-row vertical">
          <label className="settings-row-label">Interface font</label>
          <div className="font-grid">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`font-card ${prefs.font === f.id ? 'active' : ''}`}
                onClick={() => update({ font: f.id })}
                style={{ fontFamily: f.stack }}
                aria-pressed={prefs.font === f.id}
              >
                <span className="font-card-aa">Aa</span>
                <span className="font-card-label">{f.label}</span>
                <span className="font-card-sample">{f.sample}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Account / password / logout ── */}
      <h2 className="settings-h">Account</h2>
      <div className="settings-card">
        {!pwOpen ? (
          <div className="settings-row">
            <label className="settings-row-label">Password</label>
            <div className="settings-row-value">
              <button type="button" className="settings-btn ghost" onClick={() => setPwOpen(true)}>
                Change password
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={changePw}>
            <div className="settings-row">
              <label className="settings-row-label">Current password</label>
              <div className="settings-row-value">
                <input
                  type="password"
                  className="settings-input"
                  value={pwCur}
                  autoComplete="current-password"
                  onChange={(e) => setPwCur(e.target.value)}
                  disabled={pwSaving}
                />
              </div>
            </div>
            <div className="settings-row">
              <label className="settings-row-label">New password</label>
              <div className="settings-row-value">
                <input
                  type="password"
                  className="settings-input"
                  value={pwNew}
                  autoComplete="new-password"
                  onChange={(e) => setPwNew(e.target.value)}
                  disabled={pwSaving}
                  minLength={4}
                />
              </div>
            </div>
            {pwErr && <div className="settings-error">⚠ {pwErr}</div>}
            <div className="settings-row-actions">
              {pwOk && <span className="settings-saved">✓ Password updated</span>}
              <button
                type="button"
                className="settings-btn ghost"
                onClick={() => { setPwOpen(false); setPwCur(''); setPwNew(''); setPwErr(null) }}
                disabled={pwSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="settings-btn primary"
                disabled={!pwCur || !pwNew || pwSaving}
              >
                {pwSaving ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        )}

        <div className="settings-row danger-row">
          <label className="settings-row-label">Session</label>
          <div className="settings-row-value">
            <button type="button" className="settings-btn danger" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
