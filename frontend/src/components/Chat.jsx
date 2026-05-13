import { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import { api } from '../api/client'

const QUICK = {
  super_admin: [
    'Compare Agent 1 and Agent 2 portfolios',
    'Generate weekly reports for all agents',
    "Set Rahul's weekly update format to short bullet points with simple language",
    "Generate Rahul's weekly investment update",
    'I prefer executive summaries with comparison tables',
  ],
  agent_1: [
    'Show my portfolio summary',
    "Show me Agent 2's portfolio",
    'From now on, give me portfolio answers in bullet points',
    'Update my portfolio: Client Rahul has Rs 22L in mutual funds now',
    "Generate Priya's weekly investment update",
    "Change Rahul's communication preference to detailed PDF",
  ],
  agent_2: [
    'Show my portfolio summary',
    'I prefer detailed explanations with risks and recommendations',
    'Update my portfolio: Client Arjun added Rs 5L in bonds',
    "Generate Arjun's weekly investment update",
    'What is my total AUM across all clients?',
  ],
}

export default function Chat({ currentUser, bankName, onContextUpdate, onMemoryUpdate }) {
  const [messages, setMessages]  = useState([])
  const [input, setInput]        = useState('')
  const [loading, setLoading]    = useState(false)
  const endRef   = useRef(null)
  const inputRef = useRef(null)
  const prevUser = useRef(null)

  useEffect(() => {
    if (currentUser?.user_id !== prevUser.current) {
      setMessages([])
      onContextUpdate([])
      prevUser.current = currentUser?.user_id
    }
  }, [currentUser])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const history = () => messages.map(m => ({ role: m.role, content: m.content }))

  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || !currentUser || loading) return
    setMessages(prev => [...prev, { role:'user', content:msg, timestamp: new Date().toISOString() }])
    setInput('')
    setLoading(true)
    try {
      const res = await api.chat(currentUser.user_id, msg, history())
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.response,
        intent: res.intent,
        access_denied: res.access_denied,
        memory_updated: res.memory_updated,
        timestamp: new Date().toISOString(),
      }])
      onContextUpdate(res.retrieved_context || [])
      if (res.memory_updated) onMemoryUpdate()
    } catch (err) {
      setMessages(prev => [...prev, {
        role:'assistant', content:`Error: ${err.message}`, access_denied:true,
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const quickPrompts = currentUser ? (QUICK[currentUser.user_id] || []) : []

  if (!currentUser)
    return (
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div className="welcome-banner">
          <div className="welcome-icon">🔐</div>
          <div className="welcome-title">{bankName || 'Wealth Assistant'}</div>
          <div className="welcome-sub">Select a role from the left panel to begin your secure session</div>
        </div>
      </div>
    )

  return (
    <>
      <div className="chat-msgs">
        {messages.length === 0 && (
          <div style={{ display:'flex', justifyContent:'center', padding:'32px 0' }}>
            <div className="welcome-banner" style={{ padding:'32px 24px' }}>
              <div className="welcome-icon">💬</div>
              <div className="welcome-title" style={{ fontSize:17 }}>Hello, {currentUser.name}</div>
              <div className="welcome-sub">How can I assist you today? Try a quick prompt below.</div>
            </div>
          </div>
        )}

        {messages.map((m, i) => <MessageBubble key={i} message={m} currentUser={currentUser} />)}

        {loading && (
          <div className="msg-row assistant">
            <div className="msg-av assistant">🤖</div>
            <div className="msg-bubble">
              <span className="dot"/><span className="dot"/><span className="dot"/>
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      <div className="input-area">
        {quickPrompts.length > 0 && messages.length === 0 && (
          <div className="quick-wrap">
            {quickPrompts.map(p => (
              <button key={p} className="quick-btn" onClick={() => send(p)}>
                {p.length > 48 ? p.slice(0,45)+'…' : p}
              </button>
            ))}
          </div>
        )}
        <div className="input-row">
          <textarea
            ref={inputRef}
            className="input-box"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={`Message as ${currentUser.name}… (Enter to send)`}
            rows={1}
            disabled={loading}
          />
          <button className="send-btn" onClick={() => send()} disabled={loading || !input.trim()}>
            ➤
          </button>
        </div>
      </div>
    </>
  )
}
