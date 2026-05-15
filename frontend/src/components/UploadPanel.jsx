import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'

const ACCEPT = '.pdf,.docx,.pptx,.csv,.txt,.md'
const ACCEPT_LIST = 'PDF · DOCX · PPTX · CSV · TXT · MD'

const DOC_TYPES = [
  { value: 'uploaded_document',  label: 'General document' },
  { value: 'portfolio_summary',  label: 'Portfolio summary' },
  { value: 'weekly_performance', label: 'Weekly performance' },
  { value: 'research_note',      label: 'Research note' },
  { value: 'compliance_note',    label: 'Compliance note' },
  { value: 'meeting_minutes',    label: 'Meeting minutes' },
]

export default function UploadPanel({ currentUser }) {
  const [employees, setEmployees] = useState([])
  const [clients, setClients]     = useState([])
  const [loading, setLoading]     = useState(false)

  const [file, setFile]                 = useState(null)
  const [assignedEmployee, setEmp]      = useState('')
  const [clientId, setClientId]         = useState('general')
  const [documentType, setDocumentType] = useState('uploaded_document')
  const [uploading, setUploading]       = useState(false)
  const [result, setResult]             = useState(null)
  const [error, setError]               = useState(null)

  const fileInputRef = useRef(null)
  const dropRef      = useRef(null)

  const reload = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const [emps, cls] = await Promise.all([
        api.adminListEmployees(currentUser.user_id),
        api.adminListClients(currentUser.user_id),
      ])
      setEmployees(emps); setClients(cls)
      if (!assignedEmployee && emps.length) setEmp(emps[0].user_id)
    } catch (e) { setError(e.message) }
    finally     { setLoading(false) }
  }, [currentUser, assignedEmployee])
  useEffect(() => { reload() }, [reload])

  // Only clients assigned to the selected employee are valid targets —
  // this mirrors the backend RBAC check.
  const candidateClients = useMemo(
    () => clients.filter(c => c.assigned_employee === assignedEmployee),
    [clients, assignedEmployee],
  )

  useEffect(() => {
    if (clientId !== 'general' && !candidateClients.some(c => c.client_id === clientId)) {
      setClientId('general')
    }
  }, [candidateClients, clientId])

  const pickFile = (f) => {
    setError(null); setResult(null)
    if (!f) return
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    const ok  = ['pdf', 'docx', 'pptx', 'csv', 'txt', 'md'].includes(ext)
    if (!ok) {
      setError(`Unsupported file (.${ext}). Allowed: ${ACCEPT_LIST}.`)
      return
    }
    setFile(f)
  }

  const onDrop = (e) => {
    e.preventDefault()
    dropRef.current?.classList.remove('drag-over')
    pickFile(e.dataTransfer.files?.[0])
  }
  const onDragOver  = (e) => { e.preventDefault(); dropRef.current?.classList.add('drag-over') }
  const onDragLeave = ()  => { dropRef.current?.classList.remove('drag-over') }

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!file || !assignedEmployee || uploading) return
    setUploading(true); setError(null); setResult(null)
    try {
      const res = await api.adminUpload(currentUser.user_id, {
        file,
        assignedEmployee,
        clientId,
        documentType,
      })
      setResult(res)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  if (!currentUser || currentUser.role !== 'super_admin')
    return <div className="empty">Super Admin access only.</div>

  return (
    <form className="upload-stack" onSubmit={submit}>
      <div className="upload-intro">
        Uploaded documents are tagged with the selected employee's user_id
        and only that employee (plus Super Admin) can ever retrieve them.
      </div>

      <div
        ref={dropRef}
        className={`upload-drop ${file ? 'has-file' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        {file ? (
          <>
            <div className="upload-file-name">{file.name}</div>
            <div className="upload-file-meta">
              {(file.size / 1024).toFixed(1)} KB
              <button
                type="button"
                className="upload-remove"
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
              >
                Remove
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="upload-drop-title">Click or drop a file here</div>
            <div className="upload-drop-sub">{ACCEPT_LIST} · max 25 MB · no images</div>
          </>
        )}
      </div>

      <div className="upload-field">
        <label>Assign to employee</label>
        <select
          value={assignedEmployee}
          onChange={(e) => setEmp(e.target.value)}
          disabled={loading || uploading}
        >
          {employees.length === 0 && <option>(no employees yet)</option>}
          {employees.map(emp => (
            <option key={emp.user_id} value={emp.user_id}>
              {emp.name} — {emp.user_id}
            </option>
          ))}
        </select>
      </div>

      <div className="upload-field">
        <label>Client (must belong to that employee)</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={loading || uploading}
        >
          <option value="general">— General (not client-specific) —</option>
          {candidateClients.map(c => (
            <option key={c.client_id} value={c.client_id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="upload-field">
        <label>Document type</label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          disabled={uploading}
        >
          {DOC_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="admin-error">⚠ {error}</div>}

      {result && (
        <div className="upload-result">
          <div className="upload-result-title">✓ Uploaded</div>
          <div className="upload-result-row">
            <span>File</span><strong>{result.filename}</strong>
          </div>
          <div className="upload-result-row">
            <span>Indexed chunks</span><strong>{result.chunks_inserted} / {result.chunks_total}</strong>
          </div>
          <div className="upload-result-row">
            <span>Tagged to</span><strong>{result.portfolio_owner}</strong>
          </div>
          <div className="upload-result-row">
            <span>Client</span><strong>{result.client_id}</strong>
          </div>
        </div>
      )}

      <button
        type="submit"
        className="upload-submit"
        disabled={!file || !assignedEmployee || uploading}
      >
        {uploading ? 'Indexing…' : `Upload & index${file ? ` · ${file.name}` : ''}`}
      </button>
    </form>
  )
}
