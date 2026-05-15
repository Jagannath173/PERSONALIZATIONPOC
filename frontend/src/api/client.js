/**
 * API client — talks to the FastAPI backend.
 *
 * In dev, Vite proxies /api to localhost:8000.
 * In Docker, nginx proxies /api to the backend service.
 * Override base URL with VITE_API_BASE if needed.
 */

const BASE = import.meta.env.VITE_API_BASE || '/api'

async function request(method, path, body) {
  const init = {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  }
  if (body !== undefined) init.body = JSON.stringify(body)

  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

async function upload(path, formData) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Upload failed: ${res.status}`)
  }
  return res.json()
}

const get  = (path)        => request('GET',    path)
const post = (path, body)  => request('POST',   path, body)
const del  = (path)        => request('DELETE', path)

export const api = {
  // ─── Auth / profile ───────────────────────────────────────────────────────
  login: (username, password) => post('/auth/login', { username, password }),
  me:    (userId)             => get(`/auth/me/${userId}`),
  updateProfile: (userId, patch) =>
    request('PATCH', `/auth/profile/${userId}`, patch),

  // ─── Users / system ───────────────────────────────────────────────────────
  getUsers:   () => get('/users'),
  getClients: () => get('/clients'),
  health:     () => get('/health'),

  // ─── Chat ─────────────────────────────────────────────────────────────────
  chat: (userId, message, sessionHistory = [], usePersistentMemory = true) =>
    post('/chat', {
      user_id: userId,
      message,
      session_history: sessionHistory,
      use_persistent_memory: usePersistentMemory,
    }),

  // ─── Shared memory (persistent conversation) ──────────────────────────────
  getConversation:        (userId) => get(`/conversations/${userId}`),
  getConversationSummary: (userId) => get(`/conversations/${userId}/summary`),
  clearConversation:      (userId) => del(`/conversations/${userId}`),

  // ─── LLM-generated, RBAC-scoped starter prompts ───────────────────────────
  getSuggestions: (userId, count = 6) =>
    get(`/suggestions/${userId}?count=${count}`),

  // ─── Long-term memory (preferences) ───────────────────────────────────────
  getMemory: (userId) => get(`/memory/${userId}`),
  addMemory: (userId, memoryType, content) =>
    post('/memory/add', { user_id: userId, memory_type: memoryType, content }),
  setClientPreference: (requestingUserId, clientId, preference) =>
    post('/memory/client-preference', {
      requesting_user_id: requestingUserId,
      client_id: clientId,
      preference,
    }),

  // ─── Reports ──────────────────────────────────────────────────────────────
  employeeReport:     (employeeId, userId) => get(`/reports/employee/${employeeId}?requesting_user_id=${userId}`),
  clientReport:       (clientId, userId)   => get(`/reports/client/${clientId}?requesting_user_id=${userId}`),
  allEmployeesReport: (userId)             => get(`/reports/all-employees?requesting_user_id=${userId}`),

  // ─── Admin (super-admin only) ─────────────────────────────────────────────
  adminListEmployees: (adminId) =>
    get(`/admin/employees?requesting_user_id=${adminId}`),
  adminCreateEmployee: (adminId, payload) =>
    post(`/admin/employees?requesting_user_id=${adminId}`, payload),
  adminPatchEmployee: (adminId, employeeId, patch) =>
    request('PATCH', `/admin/employees/${employeeId}?requesting_user_id=${adminId}`, patch),
  adminDeleteEmployee: (adminId, employeeId) =>
    del(`/admin/employees/${employeeId}?requesting_user_id=${adminId}`),

  adminUpload: (adminId, { file, assignedEmployee, clientId, documentType }) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('requesting_user_id', adminId)
    fd.append('assigned_employee', assignedEmployee)
    if (clientId)     fd.append('client_id', clientId)
    if (documentType) fd.append('document_type', documentType)
    return upload(`/admin/upload`, fd)
  },

  adminListClients: (adminId) =>
    get(`/admin/clients?requesting_user_id=${adminId}`),
  adminCreateClient: (adminId, payload) =>
    post(`/admin/clients?requesting_user_id=${adminId}`, payload),
  adminPatchClient: (adminId, clientId, patch) =>
    request('PATCH', `/admin/clients/${clientId}?requesting_user_id=${adminId}`, patch),
  adminDeleteClient: (adminId, clientId) =>
    del(`/admin/clients/${clientId}?requesting_user_id=${adminId}`),
}
