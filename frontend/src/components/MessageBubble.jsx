import ReactMarkdown from 'react-markdown'

const AVATARS = { super_admin: '👑', agent_1: '🧑', agent_2: '🧑' }

export default function MessageBubble({ message, currentUser }) {
  const isUser   = message.role === 'user'
  const isDenied = message.access_denied
  const isUpdated= message.memory_updated

  return (
    <div className={`msg-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`msg-av ${isUser ? 'user' : 'assistant'}`}>
        {isUser ? (AVATARS[currentUser?.user_id] || '👤') : '🤖'}
      </div>
      <div className="msg-body">
        {!isUser && message.intent && (
          <span className="intent-tag">{message.intent.replace(/_/g,' ')}</span>
        )}
        {!isUser && isDenied  && <span className="badge denied">🚫 Access Denied</span>}
        {!isUser && isUpdated && <span className="badge updated">💾 Memory Updated</span>}

        <div className={`msg-bubble ${isDenied ? 'denied' : ''}`}>
          {isUser
            ? message.content
            : <ReactMarkdown>{message.content}</ReactMarkdown>}
        </div>

        <div className="msg-meta">
          {message.timestamp
            ? new Date(message.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
            : ''}
        </div>
      </div>
    </div>
  )
}
