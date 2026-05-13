import { useState } from 'react'

function DocCard({ doc }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="ctx-doc">
      <div className="ctx-hdr">
        <span className="ctx-owner">{doc.portfolio_owner}</span>
        <span className="ctx-score">score: {doc.score}</span>
      </div>
      <div style={{ fontSize:10, color:'var(--muted)' }}>
        Client: <strong>{doc.client_id}</strong> · {doc.document_type}
      </div>
      <div
        className="ctx-content"
        style={expanded ? { WebkitLineClamp:'unset', overflow:'visible' } : {}}
      >
        {doc.content}
      </div>
      {doc.content?.length > 160 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background:'none', border:'none', color:'var(--accent)', fontSize:10, cursor:'pointer', marginTop:3 }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export default function ContextPanel({ docs }) {
  if (!docs?.length)
    return (
      <div className="empty" style={{ padding:20 }}>
        No context retrieved yet.<br/>Ask a portfolio question to see retrieved documents.
      </div>
    )
  return (
    <div>
      <div style={{ fontSize:11, color:'var(--faint)', marginBottom:8 }}>
        {docs.length} document{docs.length !== 1 ? 's' : ''} retrieved
      </div>
      {docs.map((doc, i) => <DocCard key={doc.document_id || i} doc={doc} />)}
    </div>
  )
}
