import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

export default function MemoryPanel({ currentUser, refreshKey }) {
  const [data, setData] = useState(null)
  const [convSummary, setConvSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const [mem, conv] = await Promise.all([
        api.getMemory(currentUser.user_id),
        api.getConversationSummary(currentUser.user_id).catch(() => null),
      ])
      setData(mem)
      setConvSummary(conv)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => { load() }, [load, refreshKey])

  if (!currentUser) return <div className="empty">Select a user to view memory</div>
  if (loading)      return <div className="empty">Loading…</div>

  const userMems    = data?.user_memories || []
  const clientPrefs = data?.client_preferences || {}

  return (
    <div className="mem-stack">
      {convSummary && (
        <div className="mem-card mem-card-conv">
          <div className="mem-card-row">
            <span className="mem-card-key">Persistent turns</span>
            <span className="mem-card-val">{convSummary.message_count ?? 0}</span>
          </div>
          {convSummary.last_message_at && (
            <div className="mem-card-row">
              <span className="mem-card-key">Last activity</span>
              <span className="mem-card-val">
                {new Date(convSummary.last_message_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="s-label">
        {currentUser.role === 'super_admin' ? 'Admin' : 'Employee'} preferences — {currentUser.name}
      </div>
      {userMems.length === 0
        ? <div className="empty">No stored memories yet</div>
        : userMems.map((m) => (
            <div key={m.memory_id} className="mem-item">
              <span className={`mem-badge ${m.memory_type}`}>
                {m.memory_type.replace(/_/g, ' ')}
              </span>
              <div className="mem-content">{m.content}</div>
              <div className="mem-date">{new Date(m.updated_at).toLocaleDateString()}</div>
            </div>
          ))}

      {currentUser.role === 'super_admin' && (
        <>
          <div className="s-label" style={{ marginTop: 18 }}>Client Communication Prefs</div>
          {Object.keys(clientPrefs).length === 0
            ? <div className="empty">None set yet</div>
            : Object.entries(clientPrefs).map(([cid, pref]) => (
                <div key={cid} className="mem-item">
                  <span className="mem-badge client_communication_preference">
                    {cid.replace('client_', '')}
                  </span>
                  <div className="mem-content">{pref.content}</div>
                  <div className="mem-date">by {pref.modified_by}</div>
                </div>
              ))}
        </>
      )}

      <button type="button" onClick={load} className="mem-refresh">
        Refresh
      </button>
    </div>
  )
}
