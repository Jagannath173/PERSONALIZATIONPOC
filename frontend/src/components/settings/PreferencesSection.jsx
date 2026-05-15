import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'

const PREF_TYPES = {
  user_preference:                 { label: 'Response style',     desc: 'How you want the assistant to format its replies to you.' },
  business_context:                { label: 'Business context',   desc: 'Recurring facts the assistant should know about your book.' },
  admin_instruction:               { label: 'Admin instruction',  desc: 'Org-level rule (Super Admin only).' },
  client_communication_preference: { label: 'Client preference',  desc: 'How a specific client should be communicated with.' },
}

export default function PreferencesSection({ user, refreshKey }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const [newType, setNewType]       = useState('user_preference')
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setError(null)
    try { setData(await api.getMemory(user.user_id)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { load() }, [load, refreshKey])

  if (!user) return null

  const userMems    = data?.user_memories || []
  const clientPrefs = data?.client_preferences || {}

  const add = async (e) => {
    e?.preventDefault?.()
    if (!newContent.trim() || saving) return
    setSaving(true); setError(null)
    try {
      await api.addMemory(user.user_id, newType, newContent.trim())
      setNewContent('')
      await load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <h2 className="settings-h">Your assistant preferences</h2>
      <p className="settings-subtitle">
        Anything saved here is sent with every chat request — it shapes how
        the assistant talks to you. Add a preference manually, or just tell
        the assistant in chat (“from now on, …”) and it will be saved here
        automatically.
      </p>

      <form className="settings-card" onSubmit={add}>
        <div className="settings-row vertical">
          <label className="settings-row-label">Add a new preference</label>
          <textarea
            className="settings-textarea"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder='e.g. "Respond in concise bullet points and avoid jargon."'
            rows={3}
            disabled={saving}
          />
        </div>

        <div className="settings-row">
          <label className="settings-row-label">Type</label>
          <div className="settings-row-value">
            <select
              className="settings-input"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              disabled={saving}
            >
              <option value="user_preference">Response style</option>
              <option value="business_context">Business context</option>
              {user.role === 'super_admin' && (
                <option value="admin_instruction">Admin instruction</option>
              )}
            </select>
          </div>
        </div>

        {error && <div className="settings-error">⚠ {error}</div>}

        <div className="settings-row-actions">
          <button
            type="submit"
            className="settings-btn primary"
            disabled={!newContent.trim() || saving}
          >
            {saving ? 'Saving…' : 'Save preference'}
          </button>
        </div>
      </form>

      <h2 className="settings-h" style={{ marginTop: 28 }}>Saved preferences</h2>

      {loading && <div className="empty">Loading…</div>}

      {!loading && userMems.length === 0 && (
        <div className="settings-card settings-empty">
          You haven't stored any preferences yet. Try saying
          <em> “from now on, respond in short bullet points” </em>
          in chat — it'll be saved here automatically.
        </div>
      )}

      {userMems.map((m) => (
        <PreferenceCard key={m.memory_id} memory={m} />
      ))}

      {user.role === 'super_admin' && Object.keys(clientPrefs).length > 0 && (
        <>
          <h2 className="settings-h" style={{ marginTop: 28 }}>Client communication preferences</h2>
          <p className="settings-subtitle">
            These control how the assistant writes weekly updates for specific clients.
          </p>
          {Object.entries(clientPrefs).map(([cid, pref]) => (
            <div key={cid} className="pref-card">
              <div className="pref-card-hd">
                <span className={`pref-badge ${pref.memory_type}`}>{PREF_TYPES[pref.memory_type]?.label || pref.memory_type}</span>
                <span className="pref-card-meta">{cid.replace(/^client_/, '')}</span>
              </div>
              <div className="pref-card-body">{pref.content}</div>
              <div className="pref-card-foot">
                Updated by {pref.modified_by} · {pref.updated_at?.slice(0, 10)}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  )
}

function PreferenceCard({ memory }) {
  const meta = PREF_TYPES[memory.memory_type] || { label: memory.memory_type }
  return (
    <div className="pref-card">
      <div className="pref-card-hd">
        <span className={`pref-badge ${memory.memory_type}`}>{meta.label}</span>
        <span className="pref-card-meta">{memory.updated_at?.slice(0, 10)}</span>
      </div>
      <div className="pref-card-body">{memory.content}</div>
    </div>
  )
}
