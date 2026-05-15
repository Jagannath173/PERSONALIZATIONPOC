import { useState } from 'react'

function DocCard({ doc }) {
  const [expanded, setExpanded] = useState(false)
  const long = (doc.content?.length || 0) > 180

  return (
    <div className="ctx-doc">
      <div className="ctx-hdr">
        <span className="ctx-owner">{doc.portfolio_owner}</span>
        <span className="ctx-score">score {doc.score}</span>
      </div>
      <div className="ctx-meta">
        Client: <strong>{doc.client_id}</strong> · <em>{doc.document_type}</em>
      </div>
      <div className={`ctx-content ${expanded ? 'expanded' : ''}`}>
        {doc.content}
      </div>
      {long && (
        <button
          type="button"
          className="ctx-toggle"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export default function ContextPanel({ docs }) {
  if (!docs?.length) {
    return (
      <div className="empty">
        No context retrieved yet.<br />
        Ask a portfolio question to see retrieved documents.
      </div>
    )
  }
  return (
    <div>
      <div className="ctx-summary">
        {docs.length} document{docs.length !== 1 ? 's' : ''} retrieved
      </div>
      {docs.map((doc, i) => <DocCard key={doc.document_id || i} doc={doc} />)}
    </div>
  )
}
