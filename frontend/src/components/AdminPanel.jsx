import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export default function AdminPanel({ currentUser }) {
  const [employees, setEmployees] = useState([])
  const [clients,   setClients]   = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [section,   setSection]   = useState('employees')

  const reload = useCallback(async () => {
    if (!currentUser) return
    setLoading(true); setError(null)
    try {
      const [emps, cls] = await Promise.all([
        api.adminListEmployees(currentUser.user_id),
        api.adminListClients(currentUser.user_id),
      ])
      setEmployees(emps)
      setClients(cls)
    } catch (e) { setError(e.message) }
    finally     { setLoading(false) }
  }, [currentUser])

  useEffect(() => { reload() }, [reload])

  if (!currentUser || currentUser.role !== 'super_admin') {
    return <div className="empty">Admin access only.</div>
  }

  return (
    <div className="admin-stack">
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${section === 'employees' ? 'active' : ''}`}
          onClick={() => setSection('employees')}
        >
          Employees ({employees.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${section === 'clients' ? 'active' : ''}`}
          onClick={() => setSection('clients')}
        >
          Clients ({clients.length})
        </button>
      </div>

      {error && <div className="admin-error">⚠ {error}</div>}
      {loading && <div className="empty">Loading…</div>}

      {section === 'employees'
        ? <EmployeeSection
            adminId={currentUser.user_id}
            employees={employees}
            clients={clients}
            onChange={reload}
          />
        : <ClientSection
            adminId={currentUser.user_id}
            employees={employees}
            clients={clients}
            onChange={reload}
          />}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
function EmployeeSection({ adminId, employees, clients, onChange }) {
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ user_id: '', name: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState(null)

  const create = async (e) => {
    e?.preventDefault?.()
    if (!form.name.trim() || !form.password) return
    setSubmitting(true); setErr(null)
    try {
      const uid = form.user_id.trim() || slug(form.name)
      await api.adminCreateEmployee(adminId, {
        user_id: uid,
        name: form.name.trim(),
        password: form.password,
      })
      setForm({ user_id: '', name: '', password: '' })
      setShowNew(false)
      onChange()
    } catch (e) { setErr(e.message) }
    finally     { setSubmitting(false) }
  }

  const remove = async (uid) => {
    if (!window.confirm(`Delete employee ${uid}? Their clients will become unassigned.`)) return
    try {
      await api.adminDeleteEmployee(adminId, uid)
      onChange()
    } catch (e) { setErr(e.message) }
  }

  return (
    <>
      <div className="admin-row-hd">
        <span>Employees</span>
        <button
          type="button"
          className="admin-add"
          onClick={() => setShowNew(s => !s)}
        >
          {showNew ? 'Cancel' : '+ Add employee'}
        </button>
      </div>

      {showNew && (
        <form className="admin-form" onSubmit={create}>
          <input
            placeholder="Name (e.g. Priya Sharma)"
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
            disabled={submitting}
          />
          <input
            placeholder={`User ID (auto: ${form.name ? slug(form.name) : 'emp_xxx'})`}
            value={form.user_id}
            onChange={(e) => setForm(f => ({ ...f, user_id: e.target.value }))}
            disabled={submitting}
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
            disabled={submitting}
          />
          {err && <div className="admin-error small">{err}</div>}
          <button
            type="submit"
            className="admin-submit"
            disabled={submitting || !form.name.trim() || !form.password}
          >
            {submitting ? 'Creating…' : 'Create employee'}
          </button>
        </form>
      )}

      {employees.length === 0
        ? <div className="empty">No employees yet</div>
        : employees.map(emp => (
            <EmployeeCard
              key={emp.user_id}
              employee={emp}
              clients={clients}
              adminId={adminId}
              onChange={onChange}
              onDelete={() => remove(emp.user_id)}
            />
          ))}
    </>
  )
}

function EmployeeCard({ employee, clients, adminId, onChange, onDelete }) {
  const assigned = new Set(employee.assigned_clients || [])
  const myClients = clients.filter(c => assigned.has(c.client_id))
  const otherUnassigned = clients.filter(c => !c.assigned_employee || c.assigned_employee === employee.user_id)
  const candidates = otherUnassigned.filter(c => !assigned.has(c.client_id))

  const assignClient = async (cid) => {
    try {
      await api.adminPatchClient(adminId, cid, { assigned_employee: employee.user_id })
      onChange()
    } catch (e) { alert(e.message) }
  }
  const unassignClient = async (cid) => {
    try {
      await api.adminPatchClient(adminId, cid, { assigned_employee: null })
      onChange()
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="admin-card">
      <div className="admin-card-hd">
        <div>
          <div className="admin-card-title">{employee.name}</div>
          <div className="admin-card-sub">
            <code>{employee.user_id}</code> · employee
          </div>
        </div>
        <button
          type="button"
          className="admin-icon-btn danger"
          onClick={onDelete}
          aria-label="Delete employee"
          title="Delete"
        >×</button>
      </div>

      <div className="admin-card-section-label">
        Clients ({myClients.length})
      </div>
      {myClients.length === 0
        ? <div className="empty small">None assigned</div>
        : (
          <div className="admin-chip-wrap">
            {myClients.map(c => (
              <span key={c.client_id} className="admin-chip">
                {c.name}
                <button
                  type="button"
                  className="admin-chip-x"
                  onClick={() => unassignClient(c.client_id)}
                  aria-label={`Unassign ${c.name}`}
                  title="Unassign"
                >×</button>
              </span>
            ))}
          </div>
        )}

      {candidates.length > 0 && (
        <div className="admin-assign-row">
          <select
            defaultValue=""
            onChange={(e) => { if (e.target.value) { assignClient(e.target.value); e.target.value = '' } }}
          >
            <option value="" disabled>+ assign client…</option>
            {candidates.map(c => (
              <option key={c.client_id} value={c.client_id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
function ClientSection({ adminId, employees, clients, onChange }) {
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ client_id: '', name: '', assigned_employee: '' })
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState(null)

  const create = async (e) => {
    e?.preventDefault?.()
    if (!form.name.trim()) return
    setSubmitting(true); setErr(null)
    try {
      const cid = form.client_id.trim() || `client_${slug(form.name)}`
      await api.adminCreateClient(adminId, {
        client_id: cid,
        name: form.name.trim(),
        assigned_employee: form.assigned_employee || null,
      })
      setForm({ client_id: '', name: '', assigned_employee: '' })
      setShowNew(false)
      onChange()
    } catch (e) { setErr(e.message) }
    finally     { setSubmitting(false) }
  }

  const remove = async (cid) => {
    if (!window.confirm(`Delete client ${cid}?`)) return
    try {
      await api.adminDeleteClient(adminId, cid)
      onChange()
    } catch (e) { setErr(e.message) }
  }

  const reassign = async (cid, empId) => {
    try {
      await api.adminPatchClient(adminId, cid, { assigned_employee: empId || null })
      onChange()
    } catch (e) { setErr(e.message) }
  }

  return (
    <>
      <div className="admin-row-hd">
        <span>Clients</span>
        <button
          type="button"
          className="admin-add"
          onClick={() => setShowNew(s => !s)}
        >
          {showNew ? 'Cancel' : '+ Add client'}
        </button>
      </div>

      {showNew && (
        <form className="admin-form" onSubmit={create}>
          <input
            placeholder="Name (e.g. Aakash Verma)"
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
            disabled={submitting}
          />
          <input
            placeholder={`Client ID (auto: client_${form.name ? slug(form.name) : 'xxx'})`}
            value={form.client_id}
            onChange={(e) => setForm(f => ({ ...f, client_id: e.target.value }))}
            disabled={submitting}
          />
          <select
            value={form.assigned_employee}
            onChange={(e) => setForm(f => ({ ...f, assigned_employee: e.target.value }))}
            disabled={submitting}
          >
            <option value="">— Unassigned —</option>
            {employees.map(e => (
              <option key={e.user_id} value={e.user_id}>{e.name}</option>
            ))}
          </select>
          {err && <div className="admin-error small">{err}</div>}
          <button
            type="submit"
            className="admin-submit"
            disabled={submitting || !form.name.trim()}
          >
            {submitting ? 'Creating…' : 'Create client'}
          </button>
        </form>
      )}

      {clients.length === 0
        ? <div className="empty">No clients yet</div>
        : clients.map(c => (
            <div key={c.client_id} className="admin-card">
              <div className="admin-card-hd">
                <div>
                  <div className="admin-card-title">{c.name}</div>
                  <div className="admin-card-sub"><code>{c.client_id}</code></div>
                </div>
                <button
                  type="button"
                  className="admin-icon-btn danger"
                  onClick={() => remove(c.client_id)}
                  aria-label={`Delete ${c.name}`}
                  title="Delete"
                >×</button>
              </div>
              <div className="admin-assign-row">
                <span className="admin-assign-label">Assigned to:</span>
                <select
                  value={c.assigned_employee || ''}
                  onChange={(e) => reassign(c.client_id, e.target.value)}
                >
                  <option value="">— Unassigned —</option>
                  {employees.map(e => (
                    <option key={e.user_id} value={e.user_id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
    </>
  )
}
