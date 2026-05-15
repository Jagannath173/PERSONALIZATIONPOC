import ReactMarkdown from 'react-markdown'

const AVATARS = { super_admin: 'SA', agent_1: 'A1', agent_2: 'A2' }

function formatTime(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function prettyIntent(intent) {
  if (!intent) return ''
  return intent.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function MessageBubble({ message, currentUser }) {
  const isUser    = message.role === 'user'
  const isDenied  = message.access_denied
  const isUpdated = message.memory_updated

  return (
    <div className={`msg-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`msg-av ${isUser ? 'user' : 'assistant'} ${currentUser?.role || ''}`}>
        {isUser ? (AVATARS[currentUser?.user_id] || 'U') : 'AI'}
      </div>

      <div className="msg-body">
        <div className="msg-tags">
          {!isUser && message.intent && (
            <span className="intent-tag">{prettyIntent(message.intent)}</span>
          )}
          {!isUser && isDenied  && <span className="badge denied">Access Denied</span>}
          {!isUser && isUpdated && <span className="badge updated">Memory Updated</span>}
        </div>

        <div className={`msg-bubble ${isDenied ? 'denied' : ''}`}>
          {isUser
            ? <span className="msg-plain">{message.content}</span>
            : <ReactMarkdown>{message.content}</ReactMarkdown>}
        </div>

        <div className="msg-meta">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  )
}
