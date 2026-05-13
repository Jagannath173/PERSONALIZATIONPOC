import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function MemoryPanel({ currentUser }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!currentUser) return
    setLoading(true)
    try { setData(await api.getMemory(currentUser.user_id)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [currentUser])

  if (!currentUser) return <div className="empty">Select a role to view memory</div>
  if (loading)      return <div className="empty">Loading…</div>

  const userMems    = data?.user_memories || []
  const clientPrefs = data?.client_preferences || {}

  return (
    <div>
      <div className="s-label">User Memory ({currentUser.name})</div>

      {userMems.length === 0
        ? <div className="empty" style={{ padding: '10px 0' }}>No stored memories yet</div>
        : userMems.map((m) => (
            <div key={m.memory_id} className="mem-item">
              <div><span className={`mem-badge ${m.memory_type}`}>{m.memory_type.replace(/_/g,' ')}</span></div>
              <div className="mem-content">{m.content}</div>
              <div style={{ fontSize:10, color:'var(--faint)', marginTop:3 }}>
                {new Date(m.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}

      {currentUser.role === 'super_admin' && (
        <>
          <div className="s-label" style={{ marginTop: 16 }}>Client Communication Prefs</div>
          {Object.keys(clientPrefs).length === 0
            ? <div className="empty" style={{ padding: '10px 0' }}>None set yet</div>
            : Object.entries(clientPrefs).map(([cid, pref]) => (
                <div key={cid} className="mem-item">
                  <div>
                    <span className="mem-badge client_communication_preference">
                      {cid.replace('client_','')}
                    </span>
                  </div>
                  <div className="mem-content">{pref.content}</div>
                  <div style={{ fontSize:10, color:'var(--faint)', marginTop:3 }}>
                    by {pref.modified_by}
                  </div>
                </div>
              ))}
        </>
      )}

      <button
        onClick={load}
        style={{ marginTop:10, width:'100%', padding:'7px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, color:'var(--muted)', cursor:'pointer', fontSize:12 }}
      >
        Refresh
      </button>
    </div>
  )
}
